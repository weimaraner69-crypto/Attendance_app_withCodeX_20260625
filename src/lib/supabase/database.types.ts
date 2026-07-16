export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<Row, Relationships extends Relationship[] = []> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: Relationships;
};

type Timestamp = string;
type DateString = string;
type TimeString = string;

export type Database = {
  public: {
    Tables: {
      organizations: Table<{
        id: string;
        name: string;
        timezone: string;
        created_at: Timestamp;
        updated_at: Timestamp;
      }>;
      user_profiles: Table<{
        id: string;
        organization_id: string;
        role: Database['public']['Enums']['app_role'];
        display_name: string;
        email: string;
        is_active: boolean;
        created_at: Timestamp;
        updated_at: Timestamp;
      }>;
      user_login_pins: Table<{
        user_id: string;
        organization_id: string;
        pin_hash: string;
        pin_updated_at: Timestamp;
        failed_attempts: number;
        locked_until: Timestamp | null;
        created_at: Timestamp;
        updated_at: Timestamp;
      }>;
      staff_password_intents: Table<{
        id: string;
        user_id: string;
        token_hash: string;
        intent_type: 'invite' | 'recovery';
        expires_at: Timestamp;
        consumed_at: Timestamp | null;
        created_at: Timestamp;
      }>;
      stores: Table<{
        id: string;
        organization_id: string;
        code: string | null;
        name: string;
        address: string | null;
        latitude: number | null;
        longitude: number | null;
        gps_radius_meters: number;
        is_active: boolean;
        created_at: Timestamp;
        updated_at: Timestamp;
      }>;
      staff: Table<{
        id: string;
        organization_id: string;
        auth_user_id: string | null;
        default_store_id: string | null;
        employee_code: string | null;
        name: string;
        name_kana: string | null;
        employment_type: Database['public']['Enums']['employment_type'] | null;
        hourly_wage: number | null;
        phone: string | null;
        email: string | null;
        pin_hash: string | null;
        pin_updated_at: Timestamp | null;
        pin_failed_attempts: number;
        pin_locked_until: Timestamp | null;
        is_active: boolean;
        joined_on: DateString | null;
        retired_on: DateString | null;
        created_at: Timestamp;
        updated_at: Timestamp;
      }>;
      kiosk_devices: Table<{
        id: string;
        organization_id: string;
        store_id: string;
        device_code: string;
        name: string;
        is_active: boolean;
        last_seen_at: Timestamp | null;
        created_at: Timestamp;
        updated_at: Timestamp;
      }>;
      store_staff_assignments: Table<{
        id: string;
        organization_id: string;
        store_id: string;
        staff_id: string;
        starts_on: DateString;
        ends_on: DateString | null;
        created_at: Timestamp;
      }>;
      manager_store_permissions: Table<{
        id: string;
        organization_id: string;
        user_id: string;
        store_id: string;
        created_at: Timestamp;
      }>;
      sr_organization_permissions: Table<{
        id: string;
        organization_id: string;
        user_id: string;
        can_export: boolean;
        created_at: Timestamp;
      }>;
      line_accounts: Table<{
        id: string;
        organization_id: string;
        staff_id: string | null;
        line_user_id: string;
        display_name: string | null;
        picture_url: string | null;
        status: Database['public']['Enums']['line_link_status'];
        linked_at: Timestamp | null;
        last_seen_at: Timestamp | null;
        created_at: Timestamp;
        updated_at: Timestamp;
      }>;
      line_link_tokens: Table<{
        id: string;
        organization_id: string;
        line_account_id: string;
        token_hash: string;
        expires_at: Timestamp;
        used_at: Timestamp | null;
        created_at: Timestamp;
      }>;
      notifications: Table<{
        id: string;
        organization_id: string;
        recipient_user_id: string | null;
        recipient_staff_id: string | null;
        title: string;
        body: string;
        notification_type: string;
        related_table: string | null;
        related_id: string | null;
        read_at: Timestamp | null;
        line_delivery_status: 'not_applicable' | 'pending' | 'delivered' | 'failed';
        line_delivered_at: Timestamp | null;
        line_delivery_error: string | null;
        created_at: Timestamp;
      }>;
      attendance_records: Table<{
        id: string;
        organization_id: string;
        store_id: string;
        staff_id: string;
        work_date: DateString;
        status: Database['public']['Enums']['attendance_status'];
        clock_in_at: Timestamp | null;
        clock_out_at: Timestamp | null;
        break_minutes: number;
        total_work_minutes: number;
        night_shift_minutes: number;
        is_manual: boolean;
        note: string | null;
        created_at: Timestamp;
        updated_at: Timestamp;
      }>;
      attendance_events: Table<{
        id: string;
        organization_id: string;
        attendance_record_id: string | null;
        store_id: string;
        staff_id: string;
        event_type: Database['public']['Enums']['attendance_event_type'];
        occurred_at: Timestamp;
        source: Database['public']['Enums']['attendance_source'];
        auth_user_id: string | null;
        kiosk_device_id: string | null;
        latitude: number | null;
        longitude: number | null;
        gps_accuracy_meters: number | null;
        distance_from_store_meters: number | null;
        gps_verified: boolean | null;
        pin_verified_at: Timestamp | null;
        line_account_id: string | null;
        line_message_id: string | null;
        created_by_user_id: string | null;
        note: string | null;
        created_at: Timestamp;
      }>;
      attendance_requests: Table<{
        id: string;
        organization_id: string;
        store_id: string;
        staff_id: string;
        attendance_record_id: string | null;
        request_type: Database['public']['Enums']['request_type'];
        target_date: DateString;
        requested_clock_in_at: Timestamp | null;
        requested_clock_out_at: Timestamp | null;
        reason: string;
        status: Database['public']['Enums']['request_status'];
        reviewed_by_user_id: string | null;
        reviewed_at: Timestamp | null;
        review_comment: string | null;
        created_at: Timestamp;
        updated_at: Timestamp;
      }>;
      shifts: Table<{
        id: string;
        organization_id: string;
        store_id: string;
        staff_id: string;
        work_date: DateString;
        start_at: Timestamp;
        end_at: Timestamp;
        break_minutes: number;
        status: Database['public']['Enums']['shift_status'];
        created_by_user_id: string | null;
        created_at: Timestamp;
        updated_at: Timestamp;
      }>;
      shift_submission_windows: Table<{
        id: string;
        organization_id: string;
        store_id: string | null;
        title: string;
        period_start: DateString;
        period_end: DateString;
        due_at: Timestamp;
        is_open: boolean;
        created_by_user_id: string | null;
        created_at: Timestamp;
        updated_at: Timestamp;
      }>;
      shift_submissions: Table<{
        id: string;
        organization_id: string;
        window_id: string;
        staff_id: string;
        status: Database['public']['Enums']['shift_submission_status'];
        submitted_at: Timestamp | null;
        source: Database['public']['Enums']['attendance_source'];
        line_account_id: string | null;
        reviewed_by_user_id: string | null;
        reviewed_at: Timestamp | null;
        review_comment: string | null;
        created_at: Timestamp;
        updated_at: Timestamp;
      }>;
      shift_submission_items: Table<
        {
          id: string;
          organization_id: string;
          submission_id: string;
          preferred_date: DateString;
          start_time: TimeString | null;
          end_time: TimeString | null;
          is_unavailable: boolean;
          note: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        },
        [
          {
            foreignKeyName: 'shift_submission_items_submission_id_fkey';
            columns: ['submission_id'];
            isOneToOne: false;
            referencedRelation: 'shift_submissions';
            referencedColumns: ['id'];
          },
        ]
      >;
      audit_logs: Table<{
        id: string;
        organization_id: string | null;
        actor_user_id: string | null;
        actor_line_account_id: string | null;
        action: string;
        target_table: string | null;
        target_id: string | null;
        metadata: Json;
        created_at: Timestamp;
      }>;
      external_api_keys: Table<{
        id: string;
        organization_id: string;
        name: string;
        key_hash: string;
        scopes: string[];
        is_active: boolean;
        last_used_at: Timestamp | null;
        expires_at: Timestamp | null;
        created_at: Timestamp;
        updated_at: Timestamp;
      }>;
      external_api_rate_limit_windows: Table<{
        key_id: string;
        window_started_at: Timestamp;
        request_count: number;
        updated_at: Timestamp;
      }>;
      external_api_access_logs: Table<{
        id: number;
        key_id: string;
        endpoint: string;
        status_code: number;
        rate_limit_window_started_at: Timestamp | null;
        at: Timestamp;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      issue_staff_password_intent: {
        Args: {
          p_user_id: string;
          p_token_hash: string;
          p_intent_type: 'invite' | 'recovery';
          p_expires_at: Timestamp;
        };
        Returns: undefined;
      };
      consume_external_api_rate_limit: {
        Args: {
          p_key_id: string;
          p_now?: Timestamp;
        };
        Returns: {
          allowed: boolean;
          remaining: number;
          reset_at: Timestamp;
        }[];
      };
    };
    Enums: {
      app_role: 'owner' | 'manager' | 'sr' | 'staff';
      attendance_status: 'not_started' | 'working' | 'on_break' | 'finished';
      attendance_event_type: 'clock_in' | 'break_start' | 'break_end' | 'clock_out';
      attendance_source: 'kiosk' | 'mobile_web' | 'line' | 'admin_manual' | 'system';
      request_type: 'attendance_correction' | 'leave' | 'overtime';
      request_status: 'pending' | 'approved' | 'rejected' | 'cancelled';
      shift_status: 'draft' | 'published' | 'confirmed' | 'completed' | 'cancelled';
      shift_submission_status: 'draft' | 'submitted' | 'approved' | 'rejected';
      line_link_status: 'pending' | 'linked' | 'blocked' | 'revoked';
      employment_type: 'full_time' | 'part_time' | 'contract' | 'temporary' | 'other';
    };
    CompositeTypes: Record<string, never>;
  };
};
