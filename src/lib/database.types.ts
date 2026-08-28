// Database types for the calling system, hand-written to match
// supabase/migrations/20260820000000_calling_team.sql.
// Regenerate with `supabase gen types typescript` once a project is linked.

export type AgentRole = "admin" | "caller" | "closer" | "agent";
export type LeadStatus =
  | "new" | "attempted" | "contacted" | "callback" | "appointment" | "won" | "lost" | "dnc";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          role: AgentRole;
          twilio_number: string | null;
          twilio_number_sid: string | null;
          daily_call_target: number;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          role?: AgentRole;
          twilio_number?: string | null;
          twilio_number_sid?: string | null;
          daily_call_target?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      call_logs: {
        Row: {
          id: string;
          agent_id: string;
          dealership_name: string | null;
          dealership_phone: string;
          direction: string;
          twilio_call_sid: string | null;
          status: string | null;
          duration_seconds: number;
          outcome: string | null;
          notes: string | null;
          recording_sid: string | null;
          is_conversion: boolean;
          lead_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          dealership_name?: string | null;
          dealership_phone: string;
          direction?: string;
          twilio_call_sid?: string | null;
          status?: string | null;
          duration_seconds?: number;
          outcome?: string | null;
          notes?: string | null;
          recording_sid?: string | null;
          is_conversion?: boolean;
          lead_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["call_logs"]["Insert"]>;
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string;
          created_by: string;
          prospect_name: string | null;
          prospect_business: string | null;
          prospect_phone: string;
          scheduled_at: string;
          notes: string | null;
          status: string;
          outcome_notes: string | null;
          closed_by: string | null;
          twilio_call_sid: string | null;
          lead_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          created_by: string;
          prospect_name?: string | null;
          prospect_business?: string | null;
          prospect_phone: string;
          scheduled_at: string;
          notes?: string | null;
          status?: string;
          outcome_notes?: string | null;
          closed_by?: string | null;
          twilio_call_sid?: string | null;
          lead_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["appointments"]["Insert"]>;
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          assigned_to: string | null;
          name: string | null;
          business: string | null;
          phone: string;
          status: LeadStatus;
          attempts: number;
          last_contacted_at: string | null;
          callback_at: string | null;
          notes: string | null;
          source: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assigned_to?: string | null;
          name?: string | null;
          business?: string | null;
          phone: string;
          status?: LeadStatus;
          attempts?: number;
          last_contacted_at?: string | null;
          callback_at?: string | null;
          notes?: string | null;
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_closer: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: {
      agent_role: AgentRole;
      lead_status: LeadStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
