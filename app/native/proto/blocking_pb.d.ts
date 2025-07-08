import * as jspb from 'google-protobuf'

import * as google_protobuf_empty_pb from 'google-protobuf/google/protobuf/empty_pb'; // proto import: "google/protobuf/empty.proto"
import * as annotations_pb from './annotations_pb'; // proto import: "annotations.proto"


export class BlockUserReq extends jspb.Message {
  getUsername(): string;
  setUsername(value: string): BlockUserReq;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): BlockUserReq.AsObject;
  static toObject(includeInstance: boolean, msg: BlockUserReq): BlockUserReq.AsObject;
  static serializeBinaryToWriter(message: BlockUserReq, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): BlockUserReq;
  static deserializeBinaryFromReader(message: BlockUserReq, reader: jspb.BinaryReader): BlockUserReq;
}

export namespace BlockUserReq {
  export type AsObject = {
    username: string,
  }
}

export class UnblockUserReq extends jspb.Message {
  getUsername(): string;
  setUsername(value: string): UnblockUserReq;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): UnblockUserReq.AsObject;
  static toObject(includeInstance: boolean, msg: UnblockUserReq): UnblockUserReq.AsObject;
  static serializeBinaryToWriter(message: UnblockUserReq, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): UnblockUserReq;
  static deserializeBinaryFromReader(message: UnblockUserReq, reader: jspb.BinaryReader): UnblockUserReq;
}

export namespace UnblockUserReq {
  export type AsObject = {
    username: string,
  }
}

export class BlockedUser extends jspb.Message {
  getUsername(): string;
  setUsername(value: string): BlockedUser;

  getName(): string;
  setName(value: string): BlockedUser;

  getAvatarThumbnailUrl(): string;
  setAvatarThumbnailUrl(value: string): BlockedUser;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): BlockedUser.AsObject;
  static toObject(includeInstance: boolean, msg: BlockedUser): BlockedUser.AsObject;
  static serializeBinaryToWriter(message: BlockedUser, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): BlockedUser;
  static deserializeBinaryFromReader(message: BlockedUser, reader: jspb.BinaryReader): BlockedUser;
}

export namespace BlockedUser {
  export type AsObject = {
    username: string,
    name: string,
    avatarThumbnailUrl: string,
  }
}

export class GetBlockedUsersRes extends jspb.Message {
  getBlockedUsersList(): Array<BlockedUser>;
  setBlockedUsersList(value: Array<BlockedUser>): GetBlockedUsersRes;
  clearBlockedUsersList(): GetBlockedUsersRes;
  addBlockedUsers(value?: BlockedUser, index?: number): BlockedUser;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetBlockedUsersRes.AsObject;
  static toObject(includeInstance: boolean, msg: GetBlockedUsersRes): GetBlockedUsersRes.AsObject;
  static serializeBinaryToWriter(message: GetBlockedUsersRes, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetBlockedUsersRes;
  static deserializeBinaryFromReader(message: GetBlockedUsersRes, reader: jspb.BinaryReader): GetBlockedUsersRes;
}

export namespace GetBlockedUsersRes {
  export type AsObject = {
    blockedUsersList: Array<BlockedUser.AsObject>,
  }
}

