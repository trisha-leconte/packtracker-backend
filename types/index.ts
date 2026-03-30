import { ObjectId } from 'mongodb';

export interface Move {
  _id: ObjectId;
  owner_id: ObjectId;
  name: string;
  start_date: Date;
  from_address?: string;
  to_address?: string;
  status: 'planning' | 'in_progress' | 'completed';
  created_at: Date;
}

export interface User {
  _id: ObjectId;
  email: string;
  password: string;
  name: string;
  created_at: Date;
}

export interface Member {
  _id: ObjectId;
  move_id: ObjectId;
  name: string;
  color: string;
  created_at: Date;
}

export interface Box {
  _id: ObjectId;
  move_id: ObjectId;
  creator_id: ObjectId;
  label: string;
  room: string;
  status: 'unpacked' | 'packed' | 'in_transit';
  created_at: Date;
  updated_at: Date;
}

export interface Item {
  _id: ObjectId;
  box_id: ObjectId;
  name: string;
  created_at: Date;
}

export interface SearchResult {
  item_id: ObjectId;
  item_name: string;
  box_id: ObjectId;
  box_label: string;
  room: string;
  status: string;
  creator_id: ObjectId;
}
