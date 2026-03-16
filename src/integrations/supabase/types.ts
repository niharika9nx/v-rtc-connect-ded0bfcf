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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          message: string | null
          send_at: string | null
          status: string | null
          type: string | null
          user_id: string | null
          user_response: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          message?: string | null
          send_at?: string | null
          status?: string | null
          type?: string | null
          user_id?: string | null
          user_response?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          message?: string | null
          send_at?: string | null
          status?: string | null
          type?: string | null
          user_id?: string | null
          user_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          admin_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          message: string | null
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          message?: string | null
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bus_details: {
        Row: {
          arrival_time: string | null
          bus_number: string | null
          capacity: number | null
          created_at: string
          departure_time: string | null
          ID: string
          route: string | null
        }
        Insert: {
          arrival_time?: string | null
          bus_number?: string | null
          capacity?: number | null
          created_at?: string
          departure_time?: string | null
          ID?: string
          route?: string | null
        }
        Update: {
          arrival_time?: string | null
          bus_number?: string | null
          capacity?: number | null
          created_at?: string
          departure_time?: string | null
          ID?: string
          route?: string | null
        }
        Relationships: []
      }
      bus_requests: {
        Row: {
          assigned_bus_number: string | null
          assigned_seat_number: number | null
          college: string | null
          comment: string | null
          created_at: string
          from_month: string | null
          id: string
          request_type: string
          requested_bus_number: string | null
          status: string
          study_year: string | null
          to_month: string | null
          updated_at: string
          user_id: string
          year: number | null
        }
        Insert: {
          assigned_bus_number?: string | null
          assigned_seat_number?: number | null
          college?: string | null
          comment?: string | null
          created_at?: string
          from_month?: string | null
          id?: string
          request_type: string
          requested_bus_number?: string | null
          status?: string
          study_year?: string | null
          to_month?: string | null
          updated_at?: string
          user_id: string
          year?: number | null
        }
        Update: {
          assigned_bus_number?: string | null
          assigned_seat_number?: number | null
          college?: string | null
          comment?: string | null
          created_at?: string
          from_month?: string | null
          id?: string
          request_type?: string
          requested_bus_number?: string | null
          status?: string
          study_year?: string | null
          to_month?: string | null
          updated_at?: string
          user_id?: string
          year?: number | null
        }
        Relationships: []
      }
      complaints: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          message: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          message?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          message?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaints_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_history: {
        Row: {
          amount: number | null
          bus_number: string | null
          created_at: string
          id: string
          month: string | null
          status: string | null
          user_id: string | null
          year: number | null
        }
        Insert: {
          amount?: number | null
          bus_number?: string | null
          created_at?: string
          id?: string
          month?: string | null
          status?: string | null
          user_id?: string | null
          year?: number | null
        }
        Update: {
          amount?: number | null
          bus_number?: string | null
          created_at?: string
          id?: string
          month?: string | null
          status?: string | null
          user_id?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_history_bus_number_fkey"
            columns: ["bus_number"]
            isOneToOne: false
            referencedRelation: "bus_details"
            referencedColumns: ["bus_number"]
          },
          {
            foreignKeyName: "fee_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      passes: {
        Row: {
          buss_pass_id: string | null
          created_at: string
          expiry_date: string | null
          id: string
          identity_card_url: string | null
          monthly_pass_url: string | null
          Name: string | null
          user_id: string | null
          verified: boolean | null
        }
        Insert: {
          buss_pass_id?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          identity_card_url?: string | null
          monthly_pass_url?: string | null
          Name?: string | null
          user_id?: string | null
          verified?: boolean | null
        }
        Update: {
          buss_pass_id?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          identity_card_url?: string | null
          monthly_pass_url?: string | null
          Name?: string | null
          user_id?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "passes_Name_fkey"
            columns: ["Name"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["name"]
          },
        ]
      }
      profiles: {
        Row: {
          branch: string | null
          bus_number: string | null
          college: string | null
          created_at: string
          department: string | null
          email: string | null
          gender: string | null
          id: string
          name: string | null
          pass_expiry_date: string | null
          phone: number | null
          registration_id: string | null
          role: string | null
          seat_number: number | null
          section: string | null
          year: string | null
        }
        Insert: {
          branch?: string | null
          bus_number?: string | null
          college?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          gender?: string | null
          id: string
          name?: string | null
          pass_expiry_date?: string | null
          phone?: number | null
          registration_id?: string | null
          role?: string | null
          seat_number?: number | null
          section?: string | null
          year?: string | null
        }
        Update: {
          branch?: string | null
          bus_number?: string | null
          college?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          name?: string | null
          pass_expiry_date?: string | null
          phone?: number | null
          registration_id?: string | null
          role?: string | null
          seat_number?: number | null
          section?: string | null
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_bus_number_fkey"
            columns: ["bus_number"]
            isOneToOne: false
            referencedRelation: "bus_details"
            referencedColumns: ["bus_number"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_announcements: {
        Row: {
          created_at: string | null
          id: string | null
          message: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          message?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          message?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "faculty" | "student"
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
    Enums: {
      app_role: ["admin", "faculty", "student"],
    },
  },
} as const
