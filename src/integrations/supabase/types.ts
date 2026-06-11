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
      debate_messages: {
        Row: {
          block_index: number
          content: string
          created_at: string
          debate_id: string
          id: string
          order_index: number
          phase: string
          role: string
          user_id: string
        }
        Insert: {
          block_index?: number
          content: string
          created_at?: string
          debate_id: string
          id?: string
          order_index: number
          phase: string
          role: string
          user_id: string
        }
        Update: {
          block_index?: number
          content?: string
          created_at?: string
          debate_id?: string
          id?: string
          order_index?: number
          phase?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debate_messages_debate_id_fkey"
            columns: ["debate_id"]
            isOneToOne: false
            referencedRelation: "debates"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_participants: {
        Row: {
          created_at: string
          debate_id: string
          display_name: string
          id: string
          image_url: string | null
          model: string | null
          persona_id: string | null
          persona_prompt: string
          role: string
          slot: number
          team: string | null
          updated_at: string
          user_id: string
          voice_id: string | null
          voice_provider: string | null
        }
        Insert: {
          created_at?: string
          debate_id: string
          display_name: string
          id?: string
          image_url?: string | null
          model?: string | null
          persona_id?: string | null
          persona_prompt?: string
          role?: string
          slot: number
          team?: string | null
          updated_at?: string
          user_id: string
          voice_id?: string | null
          voice_provider?: string | null
        }
        Update: {
          created_at?: string
          debate_id?: string
          display_name?: string
          id?: string
          image_url?: string | null
          model?: string | null
          persona_id?: string | null
          persona_prompt?: string
          role?: string
          slot?: number
          team?: string | null
          updated_at?: string
          user_id?: string
          voice_id?: string | null
          voice_provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debate_participants_debate_id_fkey"
            columns: ["debate_id"]
            isOneToOne: false
            referencedRelation: "debates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debate_participants_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      debates: {
        Row: {
          block_subtopics: Json | null
          blocks_count: number
          created_at: string
          debater_a_image_url: string | null
          debater_a_model: string
          debater_a_name: string
          debater_a_persona: string
          debater_b_image_url: string | null
          debater_b_model: string
          debater_b_name: string
          debater_b_persona: string
          direction: string | null
          dynamic_flow: boolean
          format: string
          id: string
          moderator_model: string
          moderator_tone: string
          rounds: number
          rules: string | null
          status: string
          synopsis: string | null
          topic: string
          updated_at: string
          user_id: string
          verdict: Json | null
          voice_id_a: string | null
          voice_id_b: string | null
          voice_id_mod: string | null
          voice_provider_a: string | null
          voice_provider_b: string | null
          voice_provider_mod: string | null
        }
        Insert: {
          block_subtopics?: Json | null
          blocks_count?: number
          created_at?: string
          debater_a_image_url?: string | null
          debater_a_model?: string
          debater_a_name: string
          debater_a_persona: string
          debater_b_image_url?: string | null
          debater_b_model?: string
          debater_b_name: string
          debater_b_persona: string
          direction?: string | null
          dynamic_flow?: boolean
          format?: string
          id?: string
          moderator_model?: string
          moderator_tone?: string
          rounds?: number
          rules?: string | null
          status?: string
          synopsis?: string | null
          topic: string
          updated_at?: string
          user_id: string
          verdict?: Json | null
          voice_id_a?: string | null
          voice_id_b?: string | null
          voice_id_mod?: string | null
          voice_provider_a?: string | null
          voice_provider_b?: string | null
          voice_provider_mod?: string | null
        }
        Update: {
          block_subtopics?: Json | null
          blocks_count?: number
          created_at?: string
          debater_a_image_url?: string | null
          debater_a_model?: string
          debater_a_name?: string
          debater_a_persona?: string
          debater_b_image_url?: string | null
          debater_b_model?: string
          debater_b_name?: string
          debater_b_persona?: string
          direction?: string | null
          dynamic_flow?: boolean
          format?: string
          id?: string
          moderator_model?: string
          moderator_tone?: string
          rounds?: number
          rules?: string | null
          status?: string
          synopsis?: string | null
          topic?: string
          updated_at?: string
          user_id?: string
          verdict?: Json | null
          voice_id_a?: string | null
          voice_id_b?: string | null
          voice_id_mod?: string | null
          voice_provider_a?: string | null
          voice_provider_b?: string | null
          voice_provider_mod?: string | null
        }
        Relationships: []
      }
      personas: {
        Row: {
          category: string | null
          created_at: string
          description: string
          id: string
          image_url: string | null
          is_public: boolean
          name: string
          persona_prompt: string
          updated_at: string
          user_id: string
          vignette_model: string | null
          vignette_url: string | null
          voice_clone_name: string | null
          voice_clone_source: string | null
          voice_id: string | null
          voice_provider: string | null
          voice_settings: Json | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          is_public?: boolean
          name: string
          persona_prompt: string
          updated_at?: string
          user_id: string
          vignette_model?: string | null
          vignette_url?: string | null
          voice_clone_name?: string | null
          voice_clone_source?: string | null
          voice_id?: string | null
          voice_provider?: string | null
          voice_settings?: Json | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          is_public?: boolean
          name?: string
          persona_prompt?: string
          updated_at?: string
          user_id?: string
          vignette_model?: string | null
          vignette_url?: string | null
          voice_clone_name?: string | null
          voice_clone_source?: string | null
          voice_id?: string | null
          voice_provider?: string | null
          voice_settings?: Json | null
        }
        Relationships: []
      }
      voice_presets: {
        Row: {
          created_at: string
          id: string
          is_real_person: boolean
          name: string
          notes: string | null
          storage_path: string | null
          updated_at: string
          user_id: string
          voice_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_real_person?: boolean
          name: string
          notes?: string | null
          storage_path?: string | null
          updated_at?: string
          user_id: string
          voice_url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_real_person?: boolean
          name?: string
          notes?: string | null
          storage_path?: string | null
          updated_at?: string
          user_id?: string
          voice_url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
