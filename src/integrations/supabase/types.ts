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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      backtests: {
        Row: {
          close_type: string | null
          closed_at: string | null
          created_at: string
          direction: string
          entry_price: number | null
          exit_price: number | null
          fees: number | null
          funding_fee: number | null
          id: string
          leverage: number | null
          margin: number | null
          margin_currency: string | null
          notes: string | null
          opened_at: string | null
          pnl: number
          position_size: number | null
          setup: string | null
          stop_loss: number | null
          symbol: string
          tags: string[]
          target_price: number | null
          trade_date: string
          trading_fee: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          close_type?: string | null
          closed_at?: string | null
          created_at?: string
          direction?: string
          entry_price?: number | null
          exit_price?: number | null
          fees?: number | null
          funding_fee?: number | null
          id?: string
          leverage?: number | null
          margin?: number | null
          margin_currency?: string | null
          notes?: string | null
          opened_at?: string | null
          pnl?: number
          position_size?: number | null
          setup?: string | null
          stop_loss?: number | null
          symbol: string
          tags?: string[]
          target_price?: number | null
          trade_date?: string
          trading_fee?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          close_type?: string | null
          closed_at?: string | null
          created_at?: string
          direction?: string
          entry_price?: number | null
          exit_price?: number | null
          fees?: number | null
          funding_fee?: number | null
          id?: string
          leverage?: number | null
          margin?: number | null
          margin_currency?: string | null
          notes?: string | null
          opened_at?: string | null
          pnl?: number
          position_size?: number | null
          setup?: string | null
          stop_loss?: number | null
          symbol?: string
          tags?: string[]
          target_price?: number | null
          trade_date?: string
          trading_fee?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          close_type: string | null
          closed_at: string | null
          created_at: string
          direction: string
          entry_price: number | null
          exit_price: number | null
          fees: number | null
          funding_fee: number | null
          id: string
          leverage: number | null
          margin: number | null
          margin_currency: string | null
          notes: string | null
          opened_at: string | null
          pnl: number
          position_size: number | null
          screenshot_url: string | null
          setup: string | null
          stop_loss: number | null
          symbol: string
          tags: string[]
          target_price: number | null
          trade_date: string
          trading_fee: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          close_type?: string | null
          closed_at?: string | null
          created_at?: string
          direction?: string
          entry_price?: number | null
          exit_price?: number | null
          fees?: number | null
          funding_fee?: number | null
          id?: string
          leverage?: number | null
          margin?: number | null
          margin_currency?: string | null
          notes?: string | null
          opened_at?: string | null
          pnl?: number
          position_size?: number | null
          screenshot_url?: string | null
          setup?: string | null
          stop_loss?: number | null
          symbol: string
          tags?: string[]
          target_price?: number | null
          trade_date?: string
          trading_fee?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          close_type?: string | null
          closed_at?: string | null
          created_at?: string
          direction?: string
          entry_price?: number | null
          exit_price?: number | null
          fees?: number | null
          funding_fee?: number | null
          id?: string
          leverage?: number | null
          margin?: number | null
          margin_currency?: string | null
          notes?: string | null
          opened_at?: string | null
          pnl?: number
          position_size?: number | null
          screenshot_url?: string | null
          setup?: string | null
          stop_loss?: number | null
          symbol?: string
          tags?: string[]
          target_price?: number | null
          trade_date?: string
          trading_fee?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_users: {
        Args: never
        Returns: {
          avatar_url: string
          display_name: string
          email: string
          id: string
          joined_at: string
          last_sign_in_at: string
          total_pnl: number
          trade_count: number
        }[]
      }
      get_public_profile: { Args: { _user_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
