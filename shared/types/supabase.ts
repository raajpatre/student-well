export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string
          created_at: string | null
          id: string
          metadata: Json | null
          target_id: string | null
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          target_id?: string | null
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          target_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_messages: {
        Row: {
          content: string
          id: string
          role: string
          sent_at: string | null
          session_id: string
          tenant_id: string
        }
        Insert: {
          content: string
          id?: string
          role: string
          sent_at?: string | null
          session_id: string
          tenant_id: string
        }
        Update: {
          content?: string
          id?: string
          role?: string
          sent_at?: string | null
          session_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chatbot_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_sessions: {
        Row: {
          ended_at: string | null
          escalation_level: number | null
          id: string
          started_at: string | null
          student_id: string
          student_shared: boolean | null
          tenant_id: string
        }
        Insert: {
          ended_at?: string | null
          escalation_level?: number | null
          id?: string
          started_at?: string | null
          student_id: string
          student_shared?: boolean | null
          tenant_id: string
        }
        Update: {
          ended_at?: string | null
          escalation_level?: number | null
          id?: string
          started_at?: string | null
          student_id?: string
          student_shared?: boolean | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          dimension: string
          id: string
          response_score: number
          student_id: string
          submitted_at: string | null
          tenant_id: string
          week_start: string
        }
        Insert: {
          dimension: string
          id?: string
          response_score: number
          student_id: string
          submitted_at?: string | null
          tenant_id: string
          week_start: string
        }
        Update: {
          dimension?: string
          id?: string
          response_score?: number
          student_id?: string
          submitted_at?: string | null
          tenant_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
      colleges: {
        Row: {
          created_at: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      counsellor_assignments: {
        Row: {
          assigned_at: string | null
          counsellor_id: string
          first_contact_at: string | null
          flag_id: string
          id: string
          manager_note: string | null
          resolution_note: string | null
          resolved_at: string | null
          status: string
          student_id: string
          tenant_id: string
        }
        Insert: {
          assigned_at?: string | null
          counsellor_id: string
          first_contact_at?: string | null
          flag_id: string
          id?: string
          manager_note?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          status: string
          student_id: string
          tenant_id: string
        }
        Update: {
          assigned_at?: string | null
          counsellor_id?: string
          first_contact_at?: string | null
          flag_id?: string
          id?: string
          manager_note?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "counsellor_assignments_counsellor_id_fkey"
            columns: ["counsellor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counsellor_assignments_flag_id_fkey"
            columns: ["flag_id"]
            isOneToOne: false
            referencedRelation: "flags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counsellor_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counsellor_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
      counsellor_profiles: {
        Row: {
          capacity_limit: number | null
          counsellor_id: string
          id: string
          is_on_leave: boolean | null
          personality_description: string | null
          specialisation_tags: string[] | null
          tenant_id: string
        }
        Insert: {
          capacity_limit?: number | null
          counsellor_id: string
          id?: string
          is_on_leave?: boolean | null
          personality_description?: string | null
          specialisation_tags?: string[] | null
          tenant_id: string
        }
        Update: {
          capacity_limit?: number | null
          counsellor_id?: string
          id?: string
          is_on_leave?: boolean | null
          personality_description?: string | null
          specialisation_tags?: string[] | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "counsellor_profiles_counsellor_id_fkey"
            columns: ["counsellor_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counsellor_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
      flags: {
        Row: {
          created_at: string | null
          id: string
          resolved_note: string | null
          risk_level: string
          status: string
          student_id: string
          tenant_id: string
          triggered_dimensions: string[] | null
          updated_at: string | null
          weeks_flagged: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          resolved_note?: string | null
          risk_level: string
          status: string
          student_id: string
          tenant_id: string
          triggered_dimensions?: string[] | null
          updated_at?: string | null
          weeks_flagged?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          resolved_note?: string | null
          risk_level?: string
          status?: string
          student_id?: string
          tenant_id?: string
          triggered_dimensions?: string[] | null
          updated_at?: string | null
          weeks_flagged?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "flags_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          flagged_by: string | null
          id: string
          is_flagged: boolean | null
          space_id: string
          tenant_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          flagged_by?: string | null
          id?: string
          is_flagged?: boolean | null
          space_id: string
          tenant_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          flagged_by?: string | null
          id?: string
          is_flagged?: boolean | null
          space_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_flagged_by_fkey"
            columns: ["flagged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "social_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
      social_spaces: {
        Row: {
          branch: string | null
          created_at: string | null
          id: string
          name: string
          semester: number | null
          tags: string[] | null
          tenant_id: string
        }
        Insert: {
          branch?: string | null
          created_at?: string | null
          id?: string
          name: string
          semester?: number | null
          tags?: string[] | null
          tenant_id: string
        }
        Update: {
          branch?: string | null
          created_at?: string | null
          id?: string
          name?: string
          semester?: number | null
          tags?: string[] | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_spaces_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          batch: string | null
          branch: string | null
          created_at: string | null
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          role: string
          roll_number: string | null
          semester: number | null
          tenant_id: string
        }
        Insert: {
          batch?: string | null
          branch?: string | null
          created_at?: string | null
          full_name: string
          id: string
          is_active?: boolean | null
          phone?: string | null
          role: string
          roll_number?: string | null
          semester?: number | null
          tenant_id: string
        }
        Update: {
          batch?: string | null
          branch?: string | null
          created_at?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          role?: string
          roll_number?: string | null
          semester?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
      wellness_signals: {
        Row: {
          academic_last_updated: string | null
          academic_status: string | null
          calculated_at: string | null
          emotional_last_updated: string | null
          emotional_status: string | null
          id: string
          social_last_updated: string | null
          social_status: string | null
          student_id: string
          tenant_id: string
        }
        Insert: {
          academic_last_updated?: string | null
          academic_status?: string | null
          calculated_at?: string | null
          emotional_last_updated?: string | null
          emotional_status?: string | null
          id?: string
          social_last_updated?: string | null
          social_status?: string | null
          student_id: string
          tenant_id: string
        }
        Update: {
          academic_last_updated?: string | null
          academic_status?: string | null
          calculated_at?: string | null
          emotional_last_updated?: string | null
          emotional_status?: string | null
          id?: string
          social_last_updated?: string | null
          social_status?: string | null
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellness_signals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_auth_user_role: { Args: never; Returns: string }
      get_auth_user_tenant: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
