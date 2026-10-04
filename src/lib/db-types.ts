import type {
  Tables,
  TablesInsert,
  TablesUpdate,
} from '@/integrations/supabase/types';

export type Profile = Tables<'profiles'>;
export type ProfileUpdate = TablesUpdate<'profiles'>;
export type Pass = Tables<'passes'>;
export type PassInsert = TablesInsert<'passes'>;
export type FeeHistory = Tables<'fee_history'>;
export type FeeHistoryInsert = TablesInsert<'fee_history'>;
export type BusDetails = Tables<'bus_details'>;
export type BusRequest = Tables<'bus_requests'>;
export type Announcement = Tables<'announcements'>;
export type PublicAnnouncement = Tables<'public_announcements'>;
export type Complaint = Tables<'complaints'>;
export type Alert = Tables<'alerts'>;
export type UserRole = Tables<'user_roles'>;

export type BusOption = { bus_number: string; route: string | null };
