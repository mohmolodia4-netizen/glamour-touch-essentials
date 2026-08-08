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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          facebook_url: string | null
          google_sheet_webhook_url: string | null
          id: number
          instagram_url: string | null
          meta_pixel_id: string | null
          phone: string | null
          site_name: string
          telegram_bot_token: string | null
          telegram_chat_id: string | null
          tiktok_url: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          facebook_url?: string | null
          google_sheet_webhook_url?: string | null
          id?: number
          instagram_url?: string | null
          meta_pixel_id?: string | null
          phone?: string | null
          site_name?: string
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          tiktok_url?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          facebook_url?: string | null
          google_sheet_webhook_url?: string | null
          id?: number
          instagram_url?: string | null
          meta_pixel_id?: string | null
          phone?: string | null
          site_name?: string
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          tiktok_url?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          name: string
          slug: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      communes: {
        Row: {
          commune_name: string
          id: number
          postal_code: string | null
          wilaya_code: number
          wilaya_name: string
        }
        Insert: {
          commune_name: string
          id?: number
          postal_code?: string | null
          wilaya_code: number
          wilaya_name: string
        }
        Update: {
          commune_name?: string
          id?: number
          postal_code?: string | null
          wilaya_code?: number
          wilaya_name?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          adresse: string | null
          commune: string
          created_at: string
          delivery_type: string
          full_name: string
          id: string
          phone: string
          product_id: string | null
          product_name: string
          product_price: number
          quantity: number
          sheet_sent_at: string | null
          shipping_fee: number
          status: string
          total: number
          updated_at: string
          wilaya_id: number
          wilaya_name: string
        }
        Insert: {
          adresse?: string | null
          commune: string
          created_at?: string
          delivery_type: string
          full_name: string
          id?: string
          phone: string
          product_id?: string | null
          product_name: string
          product_price: number
          quantity?: number
          sheet_sent_at?: string | null
          shipping_fee: number
          status?: string
          total: number
          updated_at?: string
          wilaya_id: number
          wilaya_name: string
        }
        Update: {
          adresse?: string | null
          commune?: string
          created_at?: string
          delivery_type?: string
          full_name?: string
          id?: string
          phone?: string
          product_id?: string | null
          product_name?: string
          product_price?: number
          quantity?: number
          sheet_sent_at?: string | null
          shipping_fee?: number
          status?: string
          total?: number
          updated_at?: string
          wilaya_id?: number
          wilaya_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          featured: boolean
          id: string
          image_url: string | null
          image_urls: string[]
          name: string
          old_price: number | null
          price: number
          status: string
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          image_urls?: string[]
          name: string
          old_price?: number | null
          price: number
          status?: string
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          image_urls?: string[]
          name?: string
          old_price?: number | null
          price?: number
          status?: string
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_rates: {
        Row: {
          domicile_fee: number
          stopdesk_fee: number
          wilaya_code: number
          wilaya_name: string
        }
        Insert: {
          domicile_fee: number
          stopdesk_fee: number
          wilaya_code: number
          wilaya_name: string
        }
        Update: {
          domicile_fee?: number
          stopdesk_fee?: number
          wilaya_code?: number
          wilaya_name?: string
        }
        Relationships: []
      }
      stopdesks: {
        Row: {
          address: string
          commune_name: string
          desk_code: string | null
          desk_name: string
          id: number
          wilaya_code: number
          wilaya_name: string
        }
        Insert: {
          address: string
          commune_name: string
          desk_code?: string | null
          desk_name: string
          id?: number
          wilaya_code: number
          wilaya_name: string
        }
        Update: {
          address?: string
          commune_name?: string
          desk_code?: string | null
          desk_name?: string
          id?: number
          wilaya_code?: number
          wilaya_name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      claim_first_admin: { Args: never; Returns: boolean }
      get_public_settings: {
        Args: never
        Returns: {
          facebook_url: string
          instagram_url: string
          meta_pixel_id: string
          phone: string
          site_name: string
          tiktok_url: string
          whatsapp: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      place_order: {
        Args: {
          _adresse: string
          _commune: string
          _delivery_type: string
          _full_name: string
          _phone: string
          _product_id: string
          _quantity: number
          _wilaya_code: number
        }
        Returns: string
      }
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
      app_role: ["admin", "user"],
    },
  },
} as const
