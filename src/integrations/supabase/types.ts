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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          project_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          project_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_versions: {
        Row: {
          asset_id: string
          body: string | null
          created_at: string
          cta: string | null
          generation_metadata: Json | null
          headline: string | null
          id: string
          image_url: string | null
          template_id: string | null
          version: number
        }
        Insert: {
          asset_id: string
          body?: string | null
          created_at?: string
          cta?: string | null
          generation_metadata?: Json | null
          headline?: string | null
          id?: string
          image_url?: string | null
          template_id?: string | null
          version?: number
        }
        Update: {
          asset_id?: string
          body?: string | null
          created_at?: string
          cta?: string | null
          generation_metadata?: Json | null
          headline?: string | null
          id?: string
          image_url?: string | null
          template_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_versions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          attempts: number | null
          created_at: string
          destination: string | null
          dna_version_id: string | null
          fallback_chain: Json | null
          final_render_url: string | null
          folder: string | null
          id: string
          output: Database["public"]["Enums"]["output_type"]
          preset: string | null
          profile_used: Database["public"]["Enums"]["profile_level"] | null
          profile_visual_applied: boolean | null
          profile_visual_ref: string | null
          project_id: string
          provider_selected: string | null
          provider_used: string | null
          status: Database["public"]["Enums"]["asset_status"]
          tags: string[] | null
          template_id: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number | null
          created_at?: string
          destination?: string | null
          dna_version_id?: string | null
          fallback_chain?: Json | null
          final_render_url?: string | null
          folder?: string | null
          id?: string
          output?: Database["public"]["Enums"]["output_type"]
          preset?: string | null
          profile_used?: Database["public"]["Enums"]["profile_level"] | null
          profile_visual_applied?: boolean | null
          profile_visual_ref?: string | null
          project_id: string
          provider_selected?: string | null
          provider_used?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          tags?: string[] | null
          template_id?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number | null
          created_at?: string
          destination?: string | null
          dna_version_id?: string | null
          fallback_chain?: Json | null
          final_render_url?: string | null
          folder?: string | null
          id?: string
          output?: Database["public"]["Enums"]["output_type"]
          preset?: string | null
          profile_used?: Database["public"]["Enums"]["profile_level"] | null
          profile_visual_applied?: boolean | null
          profile_visual_ref?: string | null
          project_id?: string
          provider_selected?: string | null
          provider_used?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          tags?: string[] | null
          template_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_dna_version_id_fkey"
            columns: ["dna_version_id"]
            isOneToOne: false
            referencedRelation: "project_dna"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      cos_credits_log: {
        Row: {
          amount: number
          balance_after: number | null
          created_at: string
          description: string | null
          id: string
          project_id: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          user_id: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          created_at?: string
          description?: string | null
          id?: string
          project_id?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          created_at?: string
          description?: string | null
          id?: string
          project_id?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cos_credits_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cos_ledger: {
        Row: {
          asset_id: string | null
          created_at: string
          credits_cost: number
          estimated_usd: number
          id: string
          metadata: Json | null
          operation_type: string
          project_id: string
          provider_used: string
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          credits_cost?: number
          estimated_usd?: number
          id?: string
          metadata?: Json | null
          operation_type: string
          project_id: string
          provider_used: string
          user_id: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          credits_cost?: number
          estimated_usd?: number
          id?: string
          metadata?: Json | null
          operation_type?: string
          project_id?: string
          provider_used?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cos_ledger_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cos_ledger_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      library_folders: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_folder_id: string | null
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_folder_id?: string | null
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_folder_id?: string | null
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_folders_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            isOneToOne: false
            referencedRelation: "library_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_folders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      page_section_variants: {
        Row: {
          body: string | null
          created_at: string
          cta: string | null
          headline: string | null
          id: string
          image_url: string | null
          section_id: string
          style: Json | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          cta?: string | null
          headline?: string | null
          id?: string
          image_url?: string | null
          section_id: string
          style?: Json | null
        }
        Update: {
          body?: string | null
          created_at?: string
          cta?: string | null
          headline?: string | null
          id?: string
          image_url?: string | null
          section_id?: string
          style?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "page_section_variants_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "page_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      page_sections: {
        Row: {
          created_at: string
          id: string
          page_id: string
          section_type: string
          selected_variant_id: string | null
          sort_order: number
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          page_id: string
          section_type: string
          selected_variant_id?: string | null
          sort_order?: number
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          page_id?: string
          section_type?: string
          selected_variant_id?: string | null
          sort_order?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_sections_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          created_at: string
          id: string
          name: string
          page_type: Database["public"]["Enums"]["page_type"]
          project_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          page_type?: Database["public"]["Enums"]["page_type"]
          project_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          page_type?: Database["public"]["Enums"]["page_type"]
          project_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_dna_updates: {
        Row: {
          created_at: string
          id: string
          json_patch: Json
          project_id: string
          status: string
          suggestion_text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          json_patch?: Json
          project_id: string
          status?: string
          suggestion_text: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          json_patch?: Json
          project_id?: string
          status?: string
          suggestion_text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_dna_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_profile_level:
            | Database["public"]["Enums"]["profile_level"]
            | null
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_profile_level?:
            | Database["public"]["Enums"]["profile_level"]
            | null
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_profile_level?:
            | Database["public"]["Enums"]["profile_level"]
            | null
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_dna: {
        Row: {
          audience: Json | null
          created_at: string
          funnel: Json | null
          id: string
          identity: Json | null
          project_id: string
          strategy: Json | null
          updated_at: string
          version: number
          visual: Json | null
        }
        Insert: {
          audience?: Json | null
          created_at?: string
          funnel?: Json | null
          id?: string
          identity?: Json | null
          project_id: string
          strategy?: Json | null
          updated_at?: string
          version?: number
          visual?: Json | null
        }
        Update: {
          audience?: Json | null
          created_at?: string
          funnel?: Json | null
          id?: string
          identity?: Json | null
          project_id?: string
          strategy?: Json | null
          updated_at?: string
          version?: number
          visual?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "project_dna_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_memory: {
        Row: {
          category: string
          confirmed: boolean
          created_at: string
          id: string
          last_analysis_at: string | null
          occurrences: number
          pattern: string
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          confirmed?: boolean
          created_at?: string
          id?: string
          last_analysis_at?: string | null
          occurrences?: number
          pattern: string
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          confirmed?: boolean
          created_at?: string
          id?: string
          last_analysis_at?: string | null
          occurrences?: number
          pattern?: string
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_memory_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          niche: string | null
          product: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          niche?: string | null
          product?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          niche?: string | null
          product?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      provider_configs: {
        Row: {
          config: Json | null
          created_at: string
          fallback_order: number | null
          id: string
          is_active: boolean | null
          model_name: string | null
          name: string
          profile_level: Database["public"]["Enums"]["profile_level"]
          provider_type: Database["public"]["Enums"]["provider_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          fallback_order?: number | null
          id?: string
          is_active?: boolean | null
          model_name?: string | null
          name: string
          profile_level?: Database["public"]["Enums"]["profile_level"]
          provider_type: Database["public"]["Enums"]["provider_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          fallback_order?: number | null
          id?: string
          is_active?: boolean | null
          model_name?: string | null
          name?: string
          profile_level?: Database["public"]["Enums"]["profile_level"]
          provider_type?: Database["public"]["Enums"]["provider_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_templates: {
        Row: {
          content: Json
          created_at: string
          id: string
          name: string
          project_id: string
          tags: string[] | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          name: string
          project_id: string
          tags?: string[] | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          tags?: string[] | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sprint_items: {
        Row: {
          asset_id: string | null
          created_at: string
          id: string
          sprint_id: string
          status: Database["public"]["Enums"]["asset_status"] | null
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          id?: string
          sprint_id: string
          status?: Database["public"]["Enums"]["asset_status"] | null
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          id?: string
          sprint_id?: string
          status?: Database["public"]["Enums"]["asset_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "sprint_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_items_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      sprints: {
        Row: {
          budget_credits: number | null
          created_at: string
          id: string
          name: string
          output_mix: Database["public"]["Enums"]["output_type"] | null
          profile_level: Database["public"]["Enums"]["profile_level"] | null
          project_id: string
          spent_credits: number | null
          status: Database["public"]["Enums"]["sprint_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          budget_credits?: number | null
          created_at?: string
          id?: string
          name: string
          output_mix?: Database["public"]["Enums"]["output_type"] | null
          profile_level?: Database["public"]["Enums"]["profile_level"] | null
          project_id: string
          spent_credits?: number | null
          status?: Database["public"]["Enums"]["sprint_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          budget_credits?: number | null
          created_at?: string
          id?: string
          name?: string
          output_mix?: Database["public"]["Enums"]["output_type"] | null
          profile_level?: Database["public"]["Enums"]["profile_level"] | null
          project_id?: string
          spent_credits?: number | null
          status?: Database["public"]["Enums"]["sprint_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sprints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          aspect_ratio: string
          brand_overlay: boolean
          created_at: string
          id: string
          name: string
          niche_style: string | null
          project_id: string | null
          safe_zones: Json
          slots: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          aspect_ratio?: string
          brand_overlay?: boolean
          created_at?: string
          id?: string
          name: string
          niche_style?: string | null
          project_id?: string | null
          safe_zones?: Json
          slots?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          aspect_ratio?: string
          brand_overlay?: boolean
          created_at?: string
          id?: string
          name?: string
          niche_style?: string | null
          project_id?: string | null
          safe_zones?: Json
          slots?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_asset_owner: { Args: { p_asset_id: string }; Returns: boolean }
      is_page_owner: { Args: { p_page_id: string }; Returns: boolean }
      is_project_owner: { Args: { p_project_id: string }; Returns: boolean }
      is_section_owner: { Args: { p_section_id: string }; Returns: boolean }
      is_sprint_owner: { Args: { p_sprint_id: string }; Returns: boolean }
    }
    Enums: {
      asset_status:
        | "draft"
        | "review"
        | "approved"
        | "official"
        | "archived"
        | "error"
      output_type: "text" | "image" | "both"
      page_type:
        | "sales"
        | "landing"
        | "vsl"
        | "presell"
        | "advertorial"
        | "checkout"
        | "thankyou"
        | "ecommerce"
      profile_level: "economy" | "standard" | "quality"
      provider_type: "text" | "image"
      sprint_status: "active" | "paused" | "completed"
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
      asset_status: [
        "draft",
        "review",
        "approved",
        "official",
        "archived",
        "error",
      ],
      output_type: ["text", "image", "both"],
      page_type: [
        "sales",
        "landing",
        "vsl",
        "presell",
        "advertorial",
        "checkout",
        "thankyou",
        "ecommerce",
      ],
      profile_level: ["economy", "standard", "quality"],
      provider_type: ["text", "image"],
      sprint_status: ["active", "paused", "completed"],
    },
  },
} as const
