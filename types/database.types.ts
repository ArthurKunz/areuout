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
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      events: {
        Row: {
          background_url: string | null
          created_at: string | null
          description: string | null
          ends_at: string | null
          event_date: string
          host_id: string
          id: string
          invite_code: string
          location: string
          max_guests: number | null
          title: string
        }
        Insert: {
          background_url?: string | null
          created_at?: string | null
          description?: string | null
          ends_at?: string | null
          event_date: string
          host_id: string
          id?: string
          invite_code: string
          location: string
          max_guests?: number | null
          title: string
        }
        Update: {
          background_url?: string | null
          created_at?: string | null
          description?: string | null
          ends_at?: string | null
          event_date?: string
          host_id?: string
          id?: string
          invite_code?: string
          location?: string
          max_guests?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_options: {
        Row: {
          created_at: string | null
          id: string
          label: string
          pool_id: string
          position: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          label: string
          pool_id: string
          position?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string
          pool_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "pool_options_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_responses: {
        Row: {
          created_at: string | null
          id: string
          option_id: string | null
          pool_id: string
          text_response: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          option_id?: string | null
          pool_id: string
          text_response?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          option_id?: string | null
          pool_id?: string
          text_response?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pool_responses_option_id_fkey"
            columns: ["pool_id", "option_id"]
            isOneToOne: false
            referencedRelation: "pool_options"
            referencedColumns: ["pool_id", "id"]
          },
          {
            foreignKeyName: "pool_responses_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pools: {
        Row: {
          allow_multiple: boolean
          allow_text_response: boolean
          created_at: string | null
          description: string | null
          event_id: string
          id: string
          question: string
          type: string
        }
        Insert: {
          allow_multiple?: boolean
          allow_text_response?: boolean
          created_at?: string | null
          description?: string | null
          event_id: string
          id?: string
          question: string
          type: string
        }
        Update: {
          allow_multiple?: boolean
          allow_text_response?: boolean
          created_at?: string | null
          description?: string | null
          event_id?: string
          id?: string
          question?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pools_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_color: string
          avatar_url: string | null
          created_at: string | null
          firstname: string | null
          id: string
          lastname: string | null
        }
        Insert: {
          avatar_color?: string
          avatar_url?: string | null
          created_at?: string | null
          firstname?: string | null
          id: string
          lastname?: string | null
        }
        Update: {
          avatar_color?: string
          avatar_url?: string | null
          created_at?: string | null
          firstname?: string | null
          id?: string
          lastname?: string | null
        }
        Relationships: []
      }
      rsvps: {
        Row: {
          event_id: string
          id: string
          responded_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          responded_at?: string | null
          status: string
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          responded_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_self: { Args: never; Returns: undefined }
      get_event_attendees: {
        Args: { p_event_id: string }
        Returns: {
          avatar_color: string
          avatar_url: string
          firstname: string
          lastname: string
          status: string
          user_id: string
        }[]
      }
      get_event_attendees_by_invite_code: {
        Args: { p_invite_code: string }
        Returns: {
          avatar_color: string
          avatar_url: string
          firstname: string
          lastname: string
          status: string
          user_id: string
        }[]
      }
      get_event_attendees_for_events: {
        Args: { p_event_ids: string[] }
        Returns: {
          avatar_color: string
          avatar_url: string
          event_id: string
          firstname: string
          lastname: string
          status: string
          user_id: string
        }[]
      }
      get_event_host: {
        Args: { p_event_id: string }
        Returns: {
          avatar_color: string
          avatar_url: string
          firstname: string
          lastname: string
        }[]
      }
      get_event_host_by_invite_code: {
        Args: { p_invite_code: string }
        Returns: {
          avatar_color: string
          avatar_url: string
          firstname: string
          lastname: string
        }[]
      }
      get_host_info_for_events: {
        Args: { p_event_ids: string[] }
        Returns: {
          avatar_color: string
          avatar_url: string
          event_id: string
          firstname: string
          lastname: string
        }[]
      }
      get_party_by_invite_code: {
        Args: { p_invite_code: string }
        Returns: {
          background_url: string
          description: string
          ends_at: string
          event_date: string
          host_id: string
          id: string
          invite_code: string
          location: string
          max_guests: number
          title: string
        }[]
      }
      get_party_pools_by_invite_code: {
        Args: { p_invite_code: string }
        Returns: Json
      }
      get_pool_responses_by_event: {
        Args: { p_event_id: string }
        Returns: {
          avatar_color: string
          avatar_url: string
          created_at: string
          firstname: string
          id: string
          lastname: string
          option_id: string
          pool_id: string
          text_response: string
          user_id: string
        }[]
      }
      get_rsvp_counts_by_status: {
        Args: { p_event_id: string }
        Returns: {
          going_count: number
          maybe_count: number
          not_going_count: number
        }[]
      }
      get_rsvp_counts_by_status_by_invite_code: {
        Args: { p_invite_code: string }
        Returns: {
          going_count: number
          maybe_count: number
          not_going_count: number
        }[]
      }
      get_rsvp_counts_for_events: {
        Args: { p_event_ids: string[] }
        Returns: {
          attendee_count: number
          event_id: string
        }[]
      }
      is_party_member: { Args: { p_event_id: string }; Returns: boolean }
      party_has_room: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: boolean
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
