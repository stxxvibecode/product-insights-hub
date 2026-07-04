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
      answers: {
        Row: {
          created_at: string
          id: string
          question_id: string
          response_id: string
          value: Json
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          question_id: string
          response_id: string
          value?: Json
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string
          response_id?: string
          value?: Json
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_notes: {
        Row: {
          body: string | null
          created_at: string
          evidence: Json
          id: string
          owner_id: string
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          evidence?: Json
          id?: string
          owner_id: string
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          evidence?: Json
          id?: string
          owner_id?: string
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_tags: {
        Row: {
          question_id: string
          tag_id: string
        }
        Insert: {
          question_id: string
          tag_id: string
        }
        Update: {
          question_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_tags_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: string
          origin_question_id: string | null
          position: number
          required: boolean
          survey_id: string
          title: string
          type: Database["public"]["Enums"]["question_type"]
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          origin_question_id?: string | null
          position?: number
          required?: boolean
          survey_id: string
          title?: string
          type: Database["public"]["Enums"]["question_type"]
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          origin_question_id?: string | null
          position?: number
          required?: boolean
          survey_id?: string
          title?: string
          type?: Database["public"]["Enums"]["question_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      responses: {
        Row: {
          completed_at: string | null
          id: string
          ip_address: string | null
          referrer: string | null
          respondent_token: string | null
          started_at: string
          survey_id: string
          survey_version: number
          user_agent: string | null
        }
        Insert: {
          completed_at?: string | null
          id?: string
          ip_address?: string | null
          referrer?: string | null
          respondent_token?: string | null
          started_at?: string
          survey_id: string
          survey_version?: number
          user_agent?: string | null
        }
        Update: {
          completed_at?: string | null
          id?: string
          ip_address?: string | null
          referrer?: string | null
          respondent_token?: string | null
          started_at?: string
          survey_id?: string
          survey_version?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          parts: Json | null
          role: string
          survey_id: string
          tool_payload: Json | null
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          parts?: Json | null
          role: string
          survey_id: string
          tool_payload?: Json | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parts?: Json | null
          role?: string
          survey_id?: string
          tool_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_chat_messages_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_versions: {
        Row: {
          description: string | null
          id: string
          published_at: string
          questions: Json
          survey_id: string
          thank_you_screen: Json
          theme: Json
          title: string
          version: number
          welcome_screen: Json
        }
        Insert: {
          description?: string | null
          id?: string
          published_at?: string
          questions?: Json
          survey_id: string
          thank_you_screen?: Json
          theme?: Json
          title: string
          version: number
          welcome_screen?: Json
        }
        Update: {
          description?: string | null
          id?: string
          published_at?: string
          questions?: Json
          survey_id?: string
          thank_you_screen?: Json
          theme?: Json
          title?: string
          version?: number
          welcome_screen?: Json
        }
        Relationships: [
          {
            foreignKeyName: "survey_versions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_edit_draft: boolean
          owner_id: string
          parent_survey_id: string | null
          published_at: string | null
          slug: string
          status: Database["public"]["Enums"]["survey_status"]
          thank_you_screen: Json
          theme: Json
          title: string
          updated_at: string
          version: number
          welcome_screen: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_edit_draft?: boolean
          owner_id: string
          parent_survey_id?: string | null
          published_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["survey_status"]
          thank_you_screen?: Json
          theme?: Json
          title?: string
          updated_at?: string
          version?: number
          welcome_screen?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_edit_draft?: boolean
          owner_id?: string
          parent_survey_id?: string | null
          published_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["survey_status"]
          thank_you_screen?: Json
          theme?: Json
          title?: string
          updated_at?: string
          version?: number
          welcome_screen?: Json
        }
        Relationships: [
          {
            foreignKeyName: "surveys_parent_survey_id_fkey"
            columns: ["parent_survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_public_response_write: {
        Args: {
          _survey_id: string
          _respondent_token: string
          _ip_address?: string | null
          _user_agent?: string | null
          _limit?: number
          _window_seconds?: number
        }
        Returns: {
          allowed: boolean
          write_count: number
          reset_at: string
        }[]
      }
    }
    Enums: {
      question_type:
        | "short_text"
        | "long_text"
        | "email"
        | "number"
        | "single_choice"
        | "multi_choice"
        | "rating"
        | "nps"
        | "scale"
        | "yes_no"
      survey_status: "draft" | "live" | "closed"
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
      question_type: [
        "short_text",
        "long_text",
        "email",
        "number",
        "single_choice",
        "multi_choice",
        "rating",
        "nps",
        "scale",
        "yes_no",
      ],
      survey_status: ["draft", "live", "closed"],
    },
  },
} as const
