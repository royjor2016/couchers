import logging
from datetime import timedelta

import grpc
from google.protobuf import empty_pb2
from sqlalchemy.sql import delete, func, or_

from couchers import errors
from couchers.constants import FUZZY_SIMILARITY_THRESHOLD
from couchers.crypto import decrypt_page_token, encrypt_page_token
from couchers.db import can_moderate_node, get_node_parents_recursively
from couchers.materialized_views import ClusterAdminCount, ClusterSubscriptionCount
from couchers.models import (
    Cluster,
    ClusterRole,
    ClusterSubscription,
    Discussion,
    Event,
    EventOccurrence,
    Node,
    Page,
    PageType,
    User,
)
from couchers.servicers.discussions import discussion_to_pb
from couchers.servicers.events import event_to_pb
from couchers.servicers.groups import group_to_pb
from couchers.servicers.pages import page_to_pb
from couchers.sql import couchers_select as select
from couchers.utils import Timestamp_from_datetime, dt_from_millis, millis_from_dt, now
from proto import communities_pb2, communities_pb2_grpc, groups_pb2

logger = logging.getLogger(__name__)

MAX_PAGINATION_LENGTH = 25


def _parents_to_pb(session, node_id):
    parents = get_node_parents_recursively(session, node_id)
    return [
        groups_pb2.Parent(
            community=groups_pb2.CommunityParent(
                community_id=node_id,
                name=cluster.name,
                slug=cluster.slug,
                description=cluster.description,
            )
        )
        for node_id, parent_node_id, level, cluster in parents
    ]


def communities_to_pb(session, nodes: list[Node], context):
    can_moderates = [can_moderate_node(session, context.user_id, node.id) for node in nodes]

    official_clusters = [node.official_cluster for node in nodes]
    official_cluster_ids = [cluster.id for cluster in official_clusters]

    member_counts = dict(
        session.execute(
            select(ClusterSubscriptionCount.cluster_id, ClusterSubscriptionCount.count).where(
                ClusterSubscriptionCount.cluster_id.in_(official_cluster_ids)
            )
        ).all()
    )
    cluster_memberships = set(
        session.execute(
            select(ClusterSubscription.cluster_id)
            .where(ClusterSubscription.user_id == context.user_id)
            .where(ClusterSubscription.cluster_id.in_(official_cluster_ids))
        )
        .scalars()
        .all()
    )

    admin_counts = dict(
        session.execute(
            select(ClusterAdminCount.cluster_id, ClusterAdminCount.count).where(
                ClusterAdminCount.cluster_id.in_(official_cluster_ids)
            )
        ).all()
    )
    cluster_adminships = set(
        session.execute(
            select(ClusterSubscription.cluster_id)
            .where(ClusterSubscription.user_id == context.user_id)
            .where(ClusterSubscription.cluster_id.in_(official_cluster_ids))
            .where(ClusterSubscription.role == ClusterRole.admin)
        )
        .scalars()
        .all()
    )

    return [
        communities_pb2.Community(
            community_id=node.id,
            name=official_cluster.name,
            slug=official_cluster.slug,
            description=official_cluster.description,
            created=Timestamp_from_datetime(node.created),
            parents=_parents_to_pb(session, node.id),
            member=official_cluster.id in cluster_memberships,
            admin=official_cluster.id in cluster_adminships,
            member_count=member_counts.get(official_cluster.id, 1),
            admin_count=admin_counts.get(official_cluster.id, 1),
            main_page=page_to_pb(session, official_cluster.main_page, context),
            can_moderate=can_moderate,
            discussions_enabled=official_cluster.discussions_enabled,
            events_enabled=official_cluster.events_enabled,
        )
        for node, official_cluster, can_moderate in zip(nodes, official_clusters, can_moderates)
    ]


def community_to_pb(session, node: Node, context):
    return communities_to_pb(session, [node], context)[0]


class Communities(communities_pb2_grpc.CommunitiesServicer):
    def GetCommunity(self, request, context, session):
        node = session.execute(select(Node).where(Node.id == request.community_id)).scalar_one_or_none()
        if not node:
            context.abort(grpc.StatusCode.NOT_FOUND, errors.COMMUNITY_NOT_FOUND)

        return community_to_pb(session, node, context)

    def ListCommunities(self, request, context, session):
        page_size = min(MAX_PAGINATION_LENGTH, request.page_size or MAX_PAGINATION_LENGTH)
        offset = int(decrypt_page_token(request.page_token)) if request.page_token else 0
        nodes = (
            session.execute(
                select(Node)
                .join(Cluster, Cluster.parent_node_id == Node.id)
                .where(or_(Node.parent_node_id == request.community_id, request.community_id == 0))
                .where(Cluster.is_official_cluster)
                .order_by(Cluster.name)
                .limit(page_size + 1)
                .offset(offset)
            )
            .scalars()
            .all()
        )
        return communities_pb2.ListCommunitiesRes(
            communities=communities_to_pb(session, nodes[:page_size], context),
            next_page_token=encrypt_page_token(str(offset + page_size)) if len(nodes) > page_size else None,
        )

    def SearchCommunities(self, request, context, session):
        raw_q = (request.query or "").strip()
        if not raw_q:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "query_is_empty")
        if len(raw_q) < 3:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "query_too_short")

        req_size = request.page_size or MAX_PAGINATION_LENGTH
        page_size = max(1, min(MAX_PAGINATION_LENGTH, req_size))

        # page_token → offset with validation
        try:
            offset = int(decrypt_page_token(request.page_token)) if request.page_token else 0
            if offset < 0:
                raise ValueError
        except Exception:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "invalid_page_token")

        # unaccented expressions (used across all branches)
        unaccented_name = func.unaccent(Cluster.name)
        unaccented_query = func.unaccent(raw_q)

        # main trigram similarity (whole-string)
        # use default threshold; for very short queries allow down to 0.20
        sim_threshold = FUZZY_SIMILARITY_THRESHOLD
        if len(raw_q) <= 4:
            sim_threshold = min(sim_threshold, 0.20)

        similarity_score = func.similarity(unaccented_name, unaccented_query)
        word_similarity_score = func.word_similarity(unaccented_name, unaccented_query)

        base_query = select(Node).join(Cluster, Cluster.parent_node_id == Node.id).where(Cluster.is_official_cluster)

        # 3-step search strategy to balance accuracy and recall, avoiding noisy results and preserving index efficiency
        # 1) primary: similarity(...)
        q1 = (
            base_query.where(similarity_score > sim_threshold)
            .order_by(similarity_score.desc(), Cluster.name.asc(), Node.id.asc())
            .limit(page_size + 1)
            .offset(offset)
        )
        rows = session.execute(q1).scalars().all()

        # 2) fallback: word_similarity(...) via operator `<%` (index-friendly) + explicit threshold
        if not rows:
            q2 = (
                base_query.where(unaccented_name.op("<%")(unaccented_query))
                .where(word_similarity_score > 0.5)
                .order_by(word_similarity_score.desc(), Cluster.name.asc(), Node.id.asc())
                .limit(page_size + 1)
                .offset(offset)
            )
            rows = session.execute(q2).scalars().all()

        # 3) last resort: word-prefix match (e.g. query "city" → "Country 1, Region 1, City 1")
        if not rows and len(raw_q) <= 4:
            q3 = (
                base_query.where(
                    or_(
                        unaccented_name.ilike(raw_q + "%"),
                        unaccented_name.ilike("% " + raw_q + "%"),
                    )
                )
                .order_by(Cluster.name.asc(), Node.id.asc())
                .limit(page_size + 1)
                .offset(offset)
            )
            rows = session.execute(q3).scalars().all()

        if not rows:
            return communities_pb2.SearchCommunitiesRes(communities=[])

        has_next = len(rows) > page_size
        items = rows[:page_size]

        return communities_pb2.SearchCommunitiesRes(
            communities=communities_to_pb(session, items, context),
            next_page_token=encrypt_page_token(str(offset + page_size)) if has_next else None,
        )

    def ListGroups(self, request, context, session):
        page_size = min(MAX_PAGINATION_LENGTH, request.page_size or MAX_PAGINATION_LENGTH)
        next_cluster_id = int(request.page_token) if request.page_token else 0
        clusters = (
            session.execute(
                select(Cluster)
                .where(~Cluster.is_official_cluster)  # not an official group
                .where(Cluster.parent_node_id == request.community_id)
                .where(Cluster.id >= next_cluster_id)
                .order_by(Cluster.id)
                .limit(page_size + 1)
            )
            .scalars()
            .all()
        )
        return communities_pb2.ListGroupsRes(
            groups=[group_to_pb(session, cluster, context) for cluster in clusters[:page_size]],
            next_page_token=str(clusters[-1].id) if len(clusters) > page_size else None,
        )

    def ListAdmins(self, request, context, session):
        page_size = min(MAX_PAGINATION_LENGTH, request.page_size or MAX_PAGINATION_LENGTH)
        next_admin_id = int(request.page_token) if request.page_token else 0
        node = session.execute(select(Node).where(Node.id == request.community_id)).scalar_one_or_none()
        if not node:
            context.abort(grpc.StatusCode.NOT_FOUND, errors.COMMUNITY_NOT_FOUND)
        admins = (
            session.execute(
                select(User)
                .join(ClusterSubscription, ClusterSubscription.user_id == User.id)
                .where_users_visible(context)
                .where(ClusterSubscription.cluster_id == node.official_cluster.id)
                .where(ClusterSubscription.role == ClusterRole.admin)
                .where(User.id >= next_admin_id)
                .order_by(User.id)
                .limit(page_size + 1)
            )
            .scalars()
            .all()
        )
        return communities_pb2.ListAdminsRes(
            admin_user_ids=[admin.id for admin in admins[:page_size]],
            next_page_token=str(admins[-1].id) if len(admins) > page_size else None,
        )

    def AddAdmin(self, request, context, session):
        node = session.execute(select(Node).where(Node.id == request.community_id)).scalar_one_or_none()
        if not node:
            context.abort(grpc.StatusCode.NOT_FOUND, errors.COMMUNITY_NOT_FOUND)
        if not can_moderate_node(session, context.user_id, node.id):
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, errors.NODE_MODERATE_PERMISSION_DENIED)

        user = session.execute(
            select(User).where_users_visible(context).where(User.id == request.user_id)
        ).scalar_one_or_none()
        if not user:
            context.abort(grpc.StatusCode.NOT_FOUND, errors.USER_NOT_FOUND)

        subscription = session.execute(
            select(ClusterSubscription)
            .where(ClusterSubscription.user_id == user.id)
            .where(ClusterSubscription.cluster_id == node.official_cluster.id)
        ).scalar_one_or_none()
        if not subscription:
            # Can't upgrade a member to admin if they're not already a member
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, errors.USER_NOT_MEMBER)
        if subscription.role == ClusterRole.admin:
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, errors.USER_ALREADY_ADMIN)

        subscription.role = ClusterRole.admin

        return empty_pb2.Empty()

    def RemoveAdmin(self, request, context, session):
        node = session.execute(select(Node).where(Node.id == request.community_id)).scalar_one_or_none()
        if not node:
            context.abort(grpc.StatusCode.NOT_FOUND, errors.COMMUNITY_NOT_FOUND)
        if not can_moderate_node(session, context.user_id, node.id):
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, errors.NODE_MODERATE_PERMISSION_DENIED)

        user = session.execute(
            select(User).where_users_visible(context).where(User.id == request.user_id)
        ).scalar_one_or_none()
        if not user:
            context.abort(grpc.StatusCode.NOT_FOUND, errors.USER_NOT_FOUND)

        subscription = session.execute(
            select(ClusterSubscription)
            .where(ClusterSubscription.user_id == user.id)
            .where(ClusterSubscription.cluster_id == node.official_cluster.id)
        ).scalar_one_or_none()
        if not subscription:
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, errors.USER_NOT_MEMBER)
        if subscription.role == ClusterRole.member:
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, errors.USER_NOT_ADMIN)

        subscription.role = ClusterRole.member

        return empty_pb2.Empty()

    def ListMembers(self, request, context, session):
        page_size = min(MAX_PAGINATION_LENGTH, request.page_size or MAX_PAGINATION_LENGTH)
        next_member_id = int(request.page_token) if request.page_token else None

        node = session.execute(select(Node).where(Node.id == request.community_id)).scalar_one_or_none()
        if not node:
            context.abort(grpc.StatusCode.NOT_FOUND, errors.COMMUNITY_NOT_FOUND)

        query = (
            select(User)
            .join(ClusterSubscription, ClusterSubscription.user_id == User.id)
            .where_users_visible(context)
            .where(ClusterSubscription.cluster_id == node.official_cluster.id)
        )
        if next_member_id is not None:
            query = query.where(User.id <= next_member_id)
        members = session.execute(query.order_by(User.id.desc()).limit(page_size + 1)).scalars().all()

        return communities_pb2.ListMembersRes(
            member_user_ids=[member.id for member in members[:page_size]],
            next_page_token=str(members[-1].id) if len(members) > page_size else None,
        )

    def ListNearbyUsers(self, request, context, session):
        page_size = min(MAX_PAGINATION_LENGTH, request.page_size or MAX_PAGINATION_LENGTH)
        next_nearby_id = int(request.page_token) if request.page_token else 0
        node = session.execute(select(Node).where(Node.id == request.community_id)).scalar_one_or_none()
        if not node:
            context.abort(grpc.StatusCode.NOT_FOUND, errors.COMMUNITY_NOT_FOUND)
        nearbys = (
            session.execute(
                select(User)
                .where_users_visible(context)
                .where(func.ST_Contains(node.geom, User.geom))
                .where(User.id >= next_nearby_id)
                .order_by(User.id)
                .limit(page_size + 1)
            )
            .scalars()
            .all()
        )
        return communities_pb2.ListNearbyUsersRes(
            nearby_user_ids=[nearby.id for nearby in nearbys[:page_size]],
            next_page_token=str(nearbys[-1].id) if len(nearbys) > page_size else None,
        )

    def ListPlaces(self, request, context, session):
        page_size = min(MAX_PAGINATION_LENGTH, request.page_size or MAX_PAGINATION_LENGTH)
        next_page_id = int(request.page_token) if request.page_token else 0
        node = session.execute(select(Node).where(Node.id == request.community_id)).scalar_one_or_none()
        if not node:
            context.abort(grpc.StatusCode.NOT_FOUND, errors.COMMUNITY_NOT_FOUND)
        places = (
            node.official_cluster.owned_pages.where(Page.type == PageType.place)
            .where(Page.id >= next_page_id)
            .order_by(Page.id)
            .limit(page_size + 1)
            .all()
        )
        return communities_pb2.ListPlacesRes(
            places=[page_to_pb(session, page, context) for page in places[:page_size]],
            next_page_token=str(places[-1].id) if len(places) > page_size else None,
        )

    def ListGuides(self, request, context, session):
        page_size = min(MAX_PAGINATION_LENGTH, request.page_size or MAX_PAGINATION_LENGTH)
        next_page_id = int(request.page_token) if request.page_token else 0
        node = session.execute(select(Node).where(Node.id == request.community_id)).scalar_one_or_none()
        if not node:
            context.abort(grpc.StatusCode.NOT_FOUND, errors.COMMUNITY_NOT_FOUND)
        guides = (
            node.official_cluster.owned_pages.where(Page.type == PageType.guide)
            .where(Page.id >= next_page_id)
            .order_by(Page.id)
            .limit(page_size + 1)
            .all()
        )
        return communities_pb2.ListGuidesRes(
            guides=[page_to_pb(session, page, context) for page in guides[:page_size]],
            next_page_token=str(guides[-1].id) if len(guides) > page_size else None,
        )

    def ListEvents(self, request, context, session):
        page_size = min(MAX_PAGINATION_LENGTH, request.page_size or MAX_PAGINATION_LENGTH)
        # the page token is a unix timestamp of where we left off
        page_token = dt_from_millis(int(request.page_token)) if request.page_token else now()

        node = session.execute(select(Node).where(Node.id == request.community_id)).scalar_one_or_none()
        if not node:
            context.abort(grpc.StatusCode.NOT_FOUND, errors.COMMUNITY_NOT_FOUND)
        if not node.official_cluster.events_enabled:
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, errors.EVENTS_NOT_ENABLED)

        if not request.include_parents:
            nodes_clusters_to_search = [(node.id, node.official_cluster)]
        else:
            # the first value is the node_id, the last is the cluster (object)
            nodes_clusters_to_search = [
                (parent[0], parent[3]) for parent in get_node_parents_recursively(session, node.id)
            ]

        membership_clauses = []
        for node_id, official_cluster_obj in nodes_clusters_to_search:
            membership_clauses.append(Event.owner_cluster == official_cluster_obj)
            membership_clauses.append(Event.parent_node_id == node_id)

        # for communities, we list events owned by this community or for which this is a parent
        occurrences = (
            select(EventOccurrence).join(Event, Event.id == EventOccurrence.event_id).where(or_(*membership_clauses))
        )

        if request.past:
            occurrences = occurrences.where(EventOccurrence.end_time < page_token + timedelta(seconds=1)).order_by(
                EventOccurrence.start_time.desc()
            )
        else:
            occurrences = occurrences.where(EventOccurrence.end_time > page_token - timedelta(seconds=1)).order_by(
                EventOccurrence.start_time.asc()
            )

        occurrences = occurrences.limit(page_size + 1)
        occurrences = session.execute(occurrences).scalars().all()

        return communities_pb2.ListEventsRes(
            events=[event_to_pb(session, occurrence, context) for occurrence in occurrences[:page_size]],
            next_page_token=str(millis_from_dt(occurrences[-1].end_time)) if len(occurrences) > page_size else None,
        )

    def ListDiscussions(self, request, context, session):
        page_size = min(MAX_PAGINATION_LENGTH, request.page_size or MAX_PAGINATION_LENGTH)
        next_page_id = int(request.page_token) if request.page_token else 0
        node = session.execute(select(Node).where(Node.id == request.community_id)).scalar_one_or_none()
        if not node:
            context.abort(grpc.StatusCode.NOT_FOUND, errors.COMMUNITY_NOT_FOUND)
        if not node.official_cluster.discussions_enabled:
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, errors.DISCUSSIONS_NOT_ENABLED)
        discussions = (
            node.official_cluster.owned_discussions.where(or_(Discussion.id <= next_page_id, next_page_id == 0))
            .order_by(Discussion.id.desc())
            .limit(page_size + 1)
            .all()
        )
        return communities_pb2.ListDiscussionsRes(
            discussions=[discussion_to_pb(session, discussion, context) for discussion in discussions[:page_size]],
            next_page_token=str(discussions[-1].id) if len(discussions) > page_size else None,
        )

    def JoinCommunity(self, request, context, session):
        node = session.execute(select(Node).where(Node.id == request.community_id)).scalar_one_or_none()
        if not node:
            context.abort(grpc.StatusCode.NOT_FOUND, errors.COMMUNITY_NOT_FOUND)

        current_membership = node.official_cluster.members.where(User.id == context.user_id).one_or_none()
        if current_membership:
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, errors.ALREADY_IN_COMMUNITY)

        node.official_cluster.cluster_subscriptions.append(
            ClusterSubscription(
                user_id=context.user_id,
                role=ClusterRole.member,
            )
        )

        return empty_pb2.Empty()

    def LeaveCommunity(self, request, context, session):
        node = session.execute(select(Node).where(Node.id == request.community_id)).scalar_one_or_none()
        if not node:
            context.abort(grpc.StatusCode.NOT_FOUND, errors.COMMUNITY_NOT_FOUND)

        current_membership = node.official_cluster.members.where(User.id == context.user_id).one_or_none()

        if not current_membership:
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, errors.NOT_IN_COMMUNITY)

        if context.user_id in node.contained_user_ids:
            context.abort(grpc.StatusCode.FAILED_PRECONDITION, errors.CANNOT_LEAVE_CONTAINING_COMMUNITY)

        session.execute(
            delete(ClusterSubscription)
            .where(ClusterSubscription.cluster_id == node.official_cluster.id)
            .where(ClusterSubscription.user_id == context.user_id)
        )

        return empty_pb2.Empty()

    def ListUserCommunities(self, request, context, session):
        page_size = min(MAX_PAGINATION_LENGTH, request.page_size or MAX_PAGINATION_LENGTH)
        next_node_id = int(request.page_token) if request.page_token else 0
        user_id = request.user_id or context.user_id
        nodes = (
            session.execute(
                select(Node)
                .join(Cluster, Cluster.parent_node_id == Node.id)
                .join(ClusterSubscription, ClusterSubscription.cluster_id == Cluster.id)
                .where(ClusterSubscription.user_id == user_id)
                .where(Cluster.is_official_cluster)
                .where(Node.id >= next_node_id)
                .order_by(Node.id)
                .limit(page_size + 1)
            )
            .scalars()
            .all()
        )

        return communities_pb2.ListUserCommunitiesRes(
            communities=communities_to_pb(session, nodes[:page_size], context),
            next_page_token=str(nodes[-1].id) if len(nodes) > page_size else None,
        )
