/**
 * Movive — Supabase Database Types
 *
 * Generated from: supabase/migrations/00001_initial_schema.sql
 * Architecture: Supabase Only (no Prisma)
 * Decisions applied: D1 (user_id on child tables), D4 (PostgreSQL enums)
 *
 * To regenerate after schema changes:
 *   npx supabase gen types typescript --project-id tdgussivhzliuatcrndy > src/types/database.ts
 *
 * Or use --linked if project is linked:
 *   npx supabase gen types typescript --linked > src/types/database.ts
 */

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
      ai_chat_messages: {
        Row: {
          id: string
          user_id: string
          role: Database["public"]["Enums"]["ai_chat_role"]
          content: string
          channel: string
          timestamp: string
        }
        Insert: {
          id?: string
          user_id: string
          role: Database["public"]["Enums"]["ai_chat_role"]
          content: string
          channel?: string
          timestamp?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: Database["public"]["Enums"]["ai_chat_role"]
          content?: string
          channel?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          id: string
          user_id: string
          provider: Database["public"]["Enums"]["ai_provider_type"]
          model: string
          tokens_used: number
          estimated_cost: number
          prompt_type: string | null
          date: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider: Database["public"]["Enums"]["ai_provider_type"]
          model: string
          tokens_used?: number
          estimated_cost?: number
          prompt_type?: string | null
          date?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          provider?: Database["public"]["Enums"]["ai_provider_type"]
          model?: string
          tokens_used?: number
          estimated_cost?: number
          prompt_type?: string | null
          date?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          id: string
          user_id: string | null
          action: string
          entity: string | null
          entity_id: string | null
          details: string | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          entity?: string | null
          entity_id?: string | null
          details?: string | null
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          entity?: string | null
          entity_id?: string | null
          details?: string | null
          ip_address?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      beta_registrations: {
        Row: {
          id: string
          name: string
          email: string
          fitness_goal: string | null
          experience_level: string | null
          submitted_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          fitness_goal?: string | null
          experience_level?: string | null
          submitted_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          fitness_goal?: string | null
          experience_level?: string | null
          submitted_at?: string
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          id: string
          user_id: string
          date: string
          energy_level: number
          sleep_quality: number
          stress_level: number
          motivation_level: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          energy_level: number
          sleep_quality: number
          stress_level: number
          motivation_level: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          energy_level?: number
          sleep_quality?: number
          stress_level?: number
          motivation_level?: number
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          id: string
          name: string
          description: string | null
          category: Database["public"]["Enums"]["exercise_category"]
          muscle_group: Database["public"]["Enums"]["muscle_group"]
          equipment: Database["public"]["Enums"]["equipment_type"]
          difficulty: Database["public"]["Enums"]["exercise_difficulty"]
          instructions: Json
          tips: Json
          common_mistakes: Json
          image_url: string | null
          video_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category: Database["public"]["Enums"]["exercise_category"]
          muscle_group: Database["public"]["Enums"]["muscle_group"]
          equipment: Database["public"]["Enums"]["equipment_type"]
          difficulty: Database["public"]["Enums"]["exercise_difficulty"]
          instructions?: Json
          tips?: Json
          common_mistakes?: Json
          image_url?: string | null
          video_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          category?: Database["public"]["Enums"]["exercise_category"]
          muscle_group?: Database["public"]["Enums"]["muscle_group"]
          equipment?: Database["public"]["Enums"]["equipment_type"]
          difficulty?: Database["public"]["Enums"]["exercise_difficulty"]
          instructions?: Json
          tips?: Json
          common_mistakes?: Json
          image_url?: string | null
          video_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          id: string
          user_id: string | null
          type: Database["public"]["Enums"]["feedback_type"]
          title: string
          description: string | null
          priority: Database["public"]["Enums"]["recommendation_priority"] | null
          status: Database["public"]["Enums"]["feedback_status"] | null
          submitted_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          type: Database["public"]["Enums"]["feedback_type"]
          title: string
          description?: string | null
          priority?: Database["public"]["Enums"]["recommendation_priority"] | null
          status?: Database["public"]["Enums"]["feedback_status"] | null
          submitted_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          type?: Database["public"]["Enums"]["feedback_type"]
          title?: string
          description?: string | null
          priority?: Database["public"]["Enums"]["recommendation_priority"] | null
          status?: Database["public"]["Enums"]["feedback_status"] | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          id: string
          name: string
          category: Database["public"]["Enums"]["ingredient_category"]
          calories_per_100g: number
          protein_per_100g: number
          carbs_per_100g: number
          fat_per_100g: number
          unit: string
          unit_weight: number | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          category: Database["public"]["Enums"]["ingredient_category"]
          calories_per_100g: number
          protein_per_100g: number
          carbs_per_100g: number
          fat_per_100g: number
          unit?: string
          unit_weight?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: Database["public"]["Enums"]["ingredient_category"]
          calories_per_100g?: number
          protein_per_100g?: number
          carbs_per_100g?: number
          fat_per_100g?: number
          unit?: string
          unit_weight?: number | null
          created_at?: string
        }
        Relationships: []
      }
      meal_logs: {
        Row: {
          id: string
          user_id: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          name: string
          description: string | null
          calories: number
          protein: number
          carbs: number
          fat: number
          date: string
          time: string | null
          photo_url: string | null
          is_sandbox: boolean
          recipe_id: string | null
          servings: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          name: string
          description?: string | null
          calories?: number
          protein?: number
          carbs?: number
          fat?: number
          date: string
          time?: string | null
          photo_url?: string | null
          is_sandbox?: boolean
          recipe_id?: string | null
          servings?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          meal_type?: Database["public"]["Enums"]["meal_type"]
          name?: string
          description?: string | null
          calories?: number
          protein?: number
          carbs?: number
          fat?: number
          date?: string
          time?: string | null
          photo_url?: string | null
          is_sandbox?: boolean
          recipe_id?: string | null
          servings?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          id: string
          user_id: string
          name: string | null
          week_start_date: string
          week_end_date: string
          plan_data: Json
          is_saved: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name?: string | null
          week_start_date: string
          week_end_date: string
          plan_data?: Json
          is_saved?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string | null
          week_start_date?: string
          week_end_date?: string
          plan_data?: Json
          is_saved?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_entries: {
        Row: {
          id: string
          user_id: string
          date: string
          weight_kg: number | null
          neck_cm: number | null
          chest_cm: number | null
          waist_cm: number | null
          hips_cm: number | null
          left_arm_cm: number | null
          right_arm_cm: number | null
          left_thigh_cm: number | null
          right_thigh_cm: number | null
          left_calf_cm: number | null
          right_calf_cm: number | null
          is_sandbox: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          weight_kg?: number | null
          neck_cm?: number | null
          chest_cm?: number | null
          waist_cm?: number | null
          hips_cm?: number | null
          left_arm_cm?: number | null
          right_arm_cm?: number | null
          left_thigh_cm?: number | null
          right_thigh_cm?: number | null
          left_calf_cm?: number | null
          right_calf_cm?: number | null
          is_sandbox?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          weight_kg?: number | null
          neck_cm?: number | null
          chest_cm?: number | null
          waist_cm?: number | null
          hips_cm?: number | null
          left_arm_cm?: number | null
          right_arm_cm?: number | null
          left_thigh_cm?: number | null
          right_thigh_cm?: number | null
          left_calf_cm?: number | null
          right_calf_cm?: number | null
          is_sandbox?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "measurement_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          id: string
          user_id: string
          workout_reminders: boolean
          nutrition_reminders: boolean
          progress_reminders: boolean
          achievement_notifications: boolean
          recommendation_notifications: boolean
          subscription_notifications: boolean
          reminder_frequency: Database["public"]["Enums"]["reminder_frequency"]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          workout_reminders?: boolean
          nutrition_reminders?: boolean
          progress_reminders?: boolean
          achievement_notifications?: boolean
          recommendation_notifications?: boolean
          subscription_notifications?: boolean
          reminder_frequency?: Database["public"]["Enums"]["reminder_frequency"]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          workout_reminders?: boolean
          nutrition_reminders?: boolean
          progress_reminders?: boolean
          achievement_notifications?: boolean
          recommendation_notifications?: boolean
          subscription_notifications?: boolean
          reminder_frequency?: Database["public"]["Enums"]["reminder_frequency"]
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: Database["public"]["Enums"]["notification_type"]
          title: string
          message: string
          priority: Database["public"]["Enums"]["notification_priority"]
          status: Database["public"]["Enums"]["notification_status"]
          action_url: string | null
          created_at: string
          read_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          type: Database["public"]["Enums"]["notification_type"]
          title: string
          message: string
          priority?: Database["public"]["Enums"]["notification_priority"]
          status?: Database["public"]["Enums"]["notification_status"]
          action_url?: string | null
          created_at?: string
          read_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          type?: Database["public"]["Enums"]["notification_type"]
          title?: string
          message?: string
          priority?: Database["public"]["Enums"]["notification_priority"]
          status?: Database["public"]["Enums"]["notification_status"]
          action_url?: string | null
          created_at?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          value: Json
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value: Json
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      progress_photos: {
        Row: {
          id: string
          user_id: string
          photo_type: Database["public"]["Enums"]["photo_type"]
          image_url: string
          weight_kg: number | null
          notes: string | null
          upload_date: string
          is_sandbox: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          photo_type: Database["public"]["Enums"]["photo_type"]
          image_url: string
          weight_kg?: number | null
          notes?: string | null
          upload_date?: string
          is_sandbox?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          photo_type?: Database["public"]["Enums"]["photo_type"]
          image_url?: string
          weight_kg?: number | null
          notes?: string | null
          upload_date?: string
          is_sandbox?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          id: string
          recipe_id: string
          ingredient_id: string | null
          name: string
          quantity: number
          unit: string
          sort_order: number
        }
        Insert: {
          id?: string
          recipe_id: string
          ingredient_id?: string | null
          name: string
          quantity: number
          unit: string
          sort_order?: number
        }
        Update: {
          id?: string
          recipe_id?: string
          ingredient_id?: string | null
          name?: string
          quantity?: number
          unit?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_instructions: {
        Row: {
          id: string
          recipe_id: string
          step_number: number
          instruction: string
        }
        Insert: {
          id?: string
          recipe_id: string
          step_number: number
          instruction: string
        }
        Update: {
          id?: string
          recipe_id?: string
          step_number?: number
          instruction?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_instructions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          id: string
          name: string
          description: string | null
          goal: Database["public"]["Enums"]["recipe_goal"] | null
          servings: number
          prep_time: number | null
          image_url: string | null
          calories: number | null
          protein: number | null
          carbs: number | null
          fat: number | null
          meal_type: Database["public"]["Enums"]["meal_type"] | null
          recommended_meal_type: Database["public"]["Enums"]["recommended_meal_type"] | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          goal?: Database["public"]["Enums"]["recipe_goal"] | null
          servings?: number
          prep_time?: number | null
          image_url?: string | null
          calories?: number | null
          protein?: number | null
          carbs?: number | null
          fat?: number | null
          meal_type?: Database["public"]["Enums"]["meal_type"] | null
          recommended_meal_type?: Database["public"]["Enums"]["recommended_meal_type"] | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          goal?: Database["public"]["Enums"]["recipe_goal"] | null
          servings?: number
          prep_time?: number | null
          image_url?: string | null
          calories?: number | null
          protein?: number | null
          carbs?: number | null
          fat?: number | null
          meal_type?: Database["public"]["Enums"]["meal_type"] | null
          recommended_meal_type?: Database["public"]["Enums"]["recommended_meal_type"] | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_rules: {
        Row: {
          id: string
          name: string
          category: Database["public"]["Enums"]["recommendation_category"]
          description: string
          enabled: boolean
          priority: Database["public"]["Enums"]["recommendation_priority"]
          evaluator_type: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category: Database["public"]["Enums"]["recommendation_category"]
          description: string
          enabled?: boolean
          priority?: Database["public"]["Enums"]["recommendation_priority"]
          evaluator_type?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: Database["public"]["Enums"]["recommendation_category"]
          description?: string
          enabled?: boolean
          priority?: Database["public"]["Enums"]["recommendation_priority"]
          evaluator_type?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          id: string
          user_id: string
          category: Database["public"]["Enums"]["recommendation_category"]
          priority: Database["public"]["Enums"]["recommendation_priority"]
          title: string
          description: string
          status: Database["public"]["Enums"]["recommendation_status"]
          generated_date: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category: Database["public"]["Enums"]["recommendation_category"]
          priority: Database["public"]["Enums"]["recommendation_priority"]
          title: string
          description: string
          status?: Database["public"]["Enums"]["recommendation_status"]
          generated_date?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          category?: Database["public"]["Enums"]["recommendation_category"]
          priority?: Database["public"]["Enums"]["recommendation_priority"]
          title?: string
          description?: string
          status?: Database["public"]["Enums"]["recommendation_status"]
          generated_date?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      session_exercise_logs: {
        Row: {
          id: string
          session_id: string
          user_id: string
          exercise_id: string | null
          exercise_name: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          user_id: string
          exercise_id?: string | null
          exercise_name: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string
          exercise_id?: string | null
          exercise_name?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_exercise_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercise_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercise_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      session_set_logs: {
        Row: {
          id: string
          exercise_log_id: string
          user_id: string
          set_number: number
          target_reps: number | null
          completed_reps: number | null
          target_weight: number | null
          completed_weight: number | null
          completed: boolean
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          exercise_log_id: string
          user_id: string
          set_number: number
          target_reps?: number | null
          completed_reps?: number | null
          target_weight?: number | null
          completed_weight?: number | null
          completed?: boolean
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          exercise_log_id?: string
          user_id?: string
          set_number?: number
          target_reps?: number | null
          completed_reps?: number | null
          target_weight?: number | null
          completed_weight?: number | null
          completed?: boolean
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_set_logs_exercise_log_id_fkey"
            columns: ["exercise_log_id"]
            isOneToOne: false
            referencedRelation: "session_exercise_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_set_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_lists: {
        Row: {
          id: string
          user_id: string
          meal_plan_id: string | null
          name: string | null
          items: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          meal_plan_id?: string | null
          name?: string | null
          items?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          meal_plan_id?: string | null
          name?: string | null
          items?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_lists_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_list_items: {
        Row: {
          id: string
          user_id: string
          name: string
          qty: number | null
          unit: string
          category: Database["public"]["Enums"]["shopping_item_category"]
          checked: boolean
          source_recipe_id: string | null
          source_recipe_ids: string[] | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          qty?: number | null
          unit?: string
          category?: Database["public"]["Enums"]["shopping_item_category"]
          checked?: boolean
          source_recipe_id?: string | null
          source_recipe_ids?: string[] | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          qty?: number | null
          unit?: string
          category?: Database["public"]["Enums"]["shopping_item_category"]
          checked?: boolean
          source_recipe_id?: string | null
          source_recipe_ids?: string[] | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_list_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_list_items_source_recipe_id_fkey"
            columns: ["source_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          plan: Database["public"]["Enums"]["plan_type"]
          status: Database["public"]["Enums"]["subscription_status"]
          start_date: string
          renewal_date: string | null
          expiration_date: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          is_sandbox: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan?: Database["public"]["Enums"]["plan_type"]
          status?: Database["public"]["Enums"]["subscription_status"]
          start_date?: string
          renewal_date?: string | null
          expiration_date?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          is_sandbox?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plan?: Database["public"]["Enums"]["plan_type"]
          status?: Database["public"]["Enums"]["subscription_status"]
          start_date?: string
          renewal_date?: string | null
          expiration_date?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          is_sandbox?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      training_sessions: {
        Row: {
          id: string
          user_id: string
          workout_id: string | null
          workout_name: string | null
          date: string
          start_time: string
          end_time: string | null
          duration_minutes: number | null
          status: Database["public"]["Enums"]["training_session_status"]
          notes: string | null
          is_sandbox: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          workout_id?: string | null
          workout_name?: string | null
          date?: string
          start_time?: string
          end_time?: string | null
          duration_minutes?: number | null
          status?: Database["public"]["Enums"]["training_session_status"]
          notes?: string | null
          is_sandbox?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          workout_id?: string | null
          workout_name?: string | null
          date?: string
          start_time?: string
          end_time?: string | null
          duration_minutes?: number | null
          status?: Database["public"]["Enums"]["training_session_status"]
          notes?: string | null
          is_sandbox?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          event_type: string
          start_date: string
          end_date: string | null
          all_day: boolean
          color: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          event_type?: string
          start_date: string
          end_date?: string | null
          all_day?: boolean
          color?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          event_type?: string
          start_date?: string
          end_date?: string | null
          all_day?: boolean
          color?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      trigger_errors: {
        Row: {
          id: string
          source: string
          error_message: string
          error_detail: string | null
          error_hint: string | null
          payload: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          source: string
          error_message: string
          error_detail?: string | null
          error_hint?: string | null
          payload?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          source?: string
          error_message?: string
          error_detail?: string | null
          error_hint?: string | null
          payload?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          email: string
          name: string
          gender: string | null
          date_of_birth: string | null
          height_cm: number | null
          weight_kg: number | null
          activity_level: string | null
          fitness_goal: string | null
          goal_weight_kg: number | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          created_at: string
          updated_at: string
          last_login_at: string | null
          sandbox_mode: boolean
        }
        Insert: {
          id: string
          email: string
          name: string
          gender?: string | null
          date_of_birth?: string | null
          height_cm?: number | null
          weight_kg?: number | null
          activity_level?: string | null
          fitness_goal?: string | null
          goal_weight_kg?: number | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          created_at?: string
          updated_at?: string
          last_login_at?: string | null
          sandbox_mode?: boolean
        }
        Update: {
          id?: string
          email?: string
          name?: string
          gender?: string | null
          date_of_birth?: string | null
          height_cm?: number | null
          weight_kg?: number | null
          activity_level?: string | null
          fitness_goal?: string | null
          goal_weight_kg?: number | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          created_at?: string
          updated_at?: string
          last_login_at?: string | null
          sandbox_mode?: boolean
        }
        Relationships: []
      }
      water_logs: {
        Row: {
          id: string
          user_id: string
          date: string
          intake_ml: number
          goal_ml: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date?: string
          intake_ml?: number
          goal_ml?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          intake_ml?: number
          goal_ml?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      supplement_logs: {
        Row: {
          id: string
          user_id: string
          date: string
          taken: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date?: string
          taken?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          taken?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      weight_entries: {
        Row: {
          id: string
          user_id: string
          date: string
          weight_kg: number
          notes: string | null
          is_sandbox: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          weight_kg: number
          notes?: string | null
          is_sandbox?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          weight_kg?: number
          notes?: string | null
          is_sandbox?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "weight_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_days: {
        Row: {
          id: string
          workout_id: string
          user_id: string | null
          day_name: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          workout_id: string
          user_id?: string | null
          day_name: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          workout_id?: string
          user_id?: string | null
          day_name?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_days_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_exercises: {
        Row: {
          id: string
          workout_day_id: string
          user_id: string | null
          exercise_id: string | null
          exercise_name: string
          sets: number
          reps: number
          rest_seconds: number
          notes: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          workout_day_id: string
          user_id?: string | null
          exercise_id?: string | null
          exercise_name: string
          sets?: number
          reps?: number
          rest_seconds?: number
          notes?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          workout_day_id?: string
          user_id?: string | null
          exercise_id?: string | null
          exercise_name?: string
          sets?: number
          reps?: number
          rest_seconds?: number
          notes?: string | null
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_workout_day_id_fkey"
            columns: ["workout_day_id"]
            isOneToOne: false
            referencedRelation: "workout_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          id: string
          user_id: string | null
          name: string
          description: string | null
          goal: Database["public"]["Enums"]["workout_goal"] | null
          difficulty: Database["public"]["Enums"]["exercise_difficulty"] | null
          duration: number | null
          is_template: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          description?: string | null
          goal?: Database["public"]["Enums"]["workout_goal"] | null
          difficulty?: Database["public"]["Enums"]["exercise_difficulty"] | null
          duration?: number | null
          is_template?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          description?: string | null
          goal?: Database["public"]["Enums"]["workout_goal"] | null
          difficulty?: Database["public"]["Enums"]["exercise_difficulty"] | null
          duration?: number | null
          is_template?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      repair_user_profile: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      ai_chat_role: "user" | "coach" | "system"
      ai_provider_type: "openai" | "claude" | "gemini" | "local_llm" | "ollama" | "openrouter" | "rule_based"
      equipment_type: "None" | "Dumbbells" | "Barbell" | "Resistance Bands" | "Pull-Up Bar" | "Machine" | "Kettlebell"
      exercise_category: "Strength" | "Calisthenics" | "Cardio" | "Mobility" | "Flexibility"
      exercise_difficulty: "Beginner" | "Intermediate" | "Advanced"
      feedback_status: "Open" | "In Progress" | "Closed"
      feedback_type: "Bug Report" | "Feature Request" | "General Feedback"
      ingredient_category: "Protein" | "Carbohydrate" | "Fat" | "Vegetable" | "Fruit" | "Dairy" | "Beverage" | "Other"
      meal_type: "Breakfast" | "Lunch" | "Dinner" | "Snack"
      muscle_group: "Chest" | "Back" | "Shoulders" | "Biceps" | "Triceps" | "Forearms" | "Core" | "Glutes" | "Quadriceps" | "Hamstrings" | "Calves" | "Full Body"
      notification_priority: "Low" | "Medium" | "High" | "Critical"
      notification_status: "Unread" | "Read" | "Archived"
      notification_type: "Workout Reminder" | "Nutrition Reminder" | "Meal Planner Reminder" | "Progress Check-In" | "Achievement" | "Recommendation" | "Subscription" | "System"
      photo_type: "Front" | "Side" | "Back"
      plan_type: "FREE" | "PREMIUM_MONTHLY" | "PREMIUM_YEARLY"
      recipe_goal: "Fat Loss" | "Muscle Gain" | "Maintenance"
      recommended_meal_type: "Breakfast" | "Snack AM" | "Lunch" | "Snack PM" | "Dinner"
      shopping_item_category: "Produce" | "Protein" | "Dairy" | "Grains" | "Pantry" | "Beverages" | "Other"
      recommendation_category: "Nutrition" | "Training" | "Recovery" | "Weight Management" | "Consistency" | "Motivation" | "Goal Achievement"
      recommendation_priority: "Low" | "Medium" | "High" | "Critical"
      recommendation_status: "New" | "Viewed" | "Dismissed" | "Completed"
      reminder_frequency: "Daily" | "Weekly" | "Monthly" | "Never"
      subscription_status: "Active" | "Trial" | "Expired" | "Cancelled" | "Pending"
      training_session_status: "In Progress" | "Completed" | "Cancelled" | "Abandoned"
      user_role: "USER" | "ADMIN" | "SUPER_ADMIN"
      user_status: "Active" | "Suspended" | "Deleted"
      workout_goal: "Fat Loss" | "Muscle Gain" | "Strength" | "Endurance" | "Mobility" | "General Fitness"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
