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
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          avatar: Json | null
          created_at: string
          description: string | null
          genre: string
          id: string
          music_track: Json | null
          photos: string[] | null
          script: Json | null
          share_enabled: boolean | null
          share_token: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          video_generated_at: string | null
          video_generation_cancelled: boolean | null
          video_generation_started_at: string | null
          video_progress: number | null
          video_status: string | null
          video_url: string | null
          voice_sample_url: string | null
        }
        Insert: {
          avatar?: Json | null
          created_at?: string
          description?: string | null
          genre: string
          id?: string
          music_track?: Json | null
          photos?: string[] | null
          script?: Json | null
          share_enabled?: boolean | null
          share_token?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          video_generated_at?: string | null
          video_generation_cancelled?: boolean | null
          video_generation_started_at?: string | null
          video_progress?: number | null
          video_status?: string | null
          video_url?: string | null
          voice_sample_url?: string | null
        }
        Update: {
          avatar?: Json | null
          created_at?: string
          description?: string | null
          genre?: string
          id?: string
          music_track?: Json | null
          photos?: string[] | null
          script?: Json | null
          share_enabled?: boolean | null
          share_token?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          video_generated_at?: string | null
          video_generation_cancelled?: boolean | null
          video_generation_started_at?: string | null
          video_progress?: number | null
          video_status?: string | null
          video_url?: string | null
          voice_sample_url?: string | null
        }
        Relationships: []
      }
      video_annotations: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          timestamp_seconds: number
          updated_at: string
          user_id: string
          video_version_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          project_id: string
          timestamp_seconds: number
          updated_at?: string
          user_id: string
          video_version_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          timestamp_seconds?: number
          updated_at?: string
          user_id?: string
          video_version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_annotations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_annotations_video_version_id_fkey"
            columns: ["video_version_id"]
            isOneToOne: false
            referencedRelation: "video_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_versions: {
        Row: {
          created_at: string
          duration_seconds: number | null
          file_size_bytes: number | null
          id: string
          metadata: Json | null
          project_id: string
          status: string
          thumbnail_url: string | null
          version_number: number
          video_url: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          metadata?: Json | null
          project_id: string
          status?: string
          thumbnail_url?: string | null
          version_number?: number
          video_url: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          metadata?: Json | null
          project_id?: string
          status?: string
          thumbnail_url?: string | null
          version_number?: number
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
