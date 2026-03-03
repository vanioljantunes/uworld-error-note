export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          anki_connect_url: string | null
          obsidian_vault_path: string | null
          obsidian_git_remote: string | null
          encrypted_openai_key: string | null
          encrypted_anthropic_key: string | null
          encrypted_google_key: string | null
          llm_provider: 'openai' | 'anthropic' | 'google' | null
          primary_model: string | null
          economy_model: string | null
          created_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          anki_connect_url?: string | null
          obsidian_vault_path?: string | null
          obsidian_git_remote?: string | null
          encrypted_openai_key?: string | null
          encrypted_anthropic_key?: string | null
          encrypted_google_key?: string | null
          llm_provider?: 'openai' | 'anthropic' | 'google' | null
          primary_model?: string | null
          economy_model?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          anki_connect_url?: string | null
          obsidian_vault_path?: string | null
          obsidian_git_remote?: string | null
          encrypted_openai_key?: string | null
          encrypted_anthropic_key?: string | null
          encrypted_google_key?: string | null
          llm_provider?: 'openai' | 'anthropic' | 'google' | null
          primary_model?: string | null
          economy_model?: string | null
          created_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          status: 'free' | 'active' | 'past_due' | 'canceled'
          plan: 'free' | 'pro' | 'enterprise'
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          current_period_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          status?: 'free' | 'active' | 'past_due' | 'canceled'
          plan?: 'free' | 'pro' | 'enterprise'
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          status?: 'free' | 'active' | 'past_due' | 'canceled'
          plan?: 'free' | 'pro' | 'enterprise'
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          id: string
          user_id: string
          slug: string
          category: string
          title: string
          content: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          slug: string
          category: string
          title: string
          content: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          slug?: string
          category?: string
          title?: string
          content?: string
          updated_at?: string
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
