// Phase 1 database types, hand-written to match
// supabase/migrations/20260718000000_core_schema.sql.
// Regenerate with `supabase gen types typescript` once a project is linked.

export type JobStatus = "pending" | "booked" | "completed" | "paid";
export type LeadSource = "facebook" | "typebot" | "manual";
export type LeadStatus = "new" | "contacted" | "converted" | "dead";
export type TenantRole = "owner" | "member";

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          owner_phone: string;
          twilio_subaccount_sid: string | null;
          twilio_phone_number: string | null;
          stripe_connect_account_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          owner_phone: string;
          twilio_subaccount_sid?: string | null;
          twilio_phone_number?: string | null;
          stripe_connect_account_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tenants"]["Insert"]>;
        Relationships: [];
      };
      tenant_members: {
        Row: {
          tenant_id: string;
          user_id: string;
          role: TenantRole;
          created_at: string;
        };
        Insert: {
          tenant_id: string;
          user_id: string;
          role?: TenantRole;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tenant_members"]["Insert"]>;
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          tenant_id: string;
          customer_name: string | null;
          customer_phone: string;
          description: string | null;
          status: JobStatus;
          quoted_price: number | null;
          stripe_invoice_id: string | null;
          review_sms_due_at: string | null;
          review_sms_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          customer_name?: string | null;
          customer_phone: string;
          description?: string | null;
          status?: JobStatus;
          quoted_price?: number | null;
          stripe_invoice_id?: string | null;
          review_sms_due_at?: string | null;
          review_sms_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["jobs"]["Insert"]>;
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          tenant_id: string;
          name: string | null;
          phone: string;
          source: LeadSource;
          status: LeadStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name?: string | null;
          phone: string;
          source?: LeadSource;
          status?: LeadStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
        Relationships: [];
      };
      settings: {
        Row: {
          id: string;
          tenant_id: string;
          google_business_link: string | null;
          diagnostic_fee: number | null;
          ai_system_prompt: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          google_business_link?: string | null;
          diagnostic_fee?: number | null;
          ai_system_prompt?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["settings"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_tenant_member: {
        Args: { t_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      job_status: JobStatus;
      lead_source: LeadSource;
      lead_status: LeadStatus;
      tenant_role: TenantRole;
    };
    CompositeTypes: Record<string, never>;
  };
}
