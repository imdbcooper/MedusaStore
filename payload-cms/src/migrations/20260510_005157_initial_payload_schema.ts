import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor');
  CREATE TYPE "public"."enum_pages_blocks_hero_banner_actions_link_type" AS ENUM('custom', 'page', 'post', 'product', 'collection', 'category');
  CREATE TYPE "public"."enum_pages_blocks_image_text_actions_link_type" AS ENUM('custom', 'page', 'post', 'product', 'collection', 'category');
  CREATE TYPE "public"."enum_pages_blocks_image_text_layout" AS ENUM('imageLeft', 'imageRight');
  CREATE TYPE "public"."enum_pages_blocks_cta_section_actions_link_type" AS ENUM('custom', 'page', 'post', 'product', 'collection', 'category');
  CREATE TYPE "public"."enum_pages_blocks_cta_section_theme" AS ENUM('default', 'accent');
  CREATE TYPE "public"."enum_pages_page_type" AS ENUM('marketing', 'informational');
  CREATE TYPE "public"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__pages_v_blocks_hero_banner_actions_link_type" AS ENUM('custom', 'page', 'post', 'product', 'collection', 'category');
  CREATE TYPE "public"."enum__pages_v_blocks_image_text_actions_link_type" AS ENUM('custom', 'page', 'post', 'product', 'collection', 'category');
  CREATE TYPE "public"."enum__pages_v_blocks_image_text_layout" AS ENUM('imageLeft', 'imageRight');
  CREATE TYPE "public"."enum__pages_v_blocks_cta_section_actions_link_type" AS ENUM('custom', 'page', 'post', 'product', 'collection', 'category');
  CREATE TYPE "public"."enum__pages_v_blocks_cta_section_theme" AS ENUM('default', 'accent');
  CREATE TYPE "public"."enum__pages_v_version_page_type" AS ENUM('marketing', 'informational');
  CREATE TYPE "public"."enum__pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_posts_blocks_hero_banner_actions_link_type" AS ENUM('custom', 'page', 'post', 'product', 'collection', 'category');
  CREATE TYPE "public"."enum_posts_blocks_image_text_actions_link_type" AS ENUM('custom', 'page', 'post', 'product', 'collection', 'category');
  CREATE TYPE "public"."enum_posts_blocks_image_text_layout" AS ENUM('imageLeft', 'imageRight');
  CREATE TYPE "public"."enum_posts_blocks_cta_section_actions_link_type" AS ENUM('custom', 'page', 'post', 'product', 'collection', 'category');
  CREATE TYPE "public"."enum_posts_blocks_cta_section_theme" AS ENUM('default', 'accent');
  CREATE TYPE "public"."enum_posts_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__posts_v_blocks_hero_banner_actions_link_type" AS ENUM('custom', 'page', 'post', 'product', 'collection', 'category');
  CREATE TYPE "public"."enum__posts_v_blocks_image_text_actions_link_type" AS ENUM('custom', 'page', 'post', 'product', 'collection', 'category');
  CREATE TYPE "public"."enum__posts_v_blocks_image_text_layout" AS ENUM('imageLeft', 'imageRight');
  CREATE TYPE "public"."enum__posts_v_blocks_cta_section_actions_link_type" AS ENUM('custom', 'page', 'post', 'product', 'collection', 'category');
  CREATE TYPE "public"."enum__posts_v_blocks_cta_section_theme" AS ENUM('default', 'accent');
  CREATE TYPE "public"."enum__posts_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_site_settings_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__site_settings_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_navigation_items_link_type" AS ENUM('custom', 'page', 'post', 'product', 'collection', 'category');
  CREATE TYPE "public"."enum_navigation_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__navigation_v_version_items_link_type" AS ENUM('custom', 'page', 'post', 'product', 'collection', 'category');
  CREATE TYPE "public"."enum__navigation_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_footer_columns_links_link_type" AS ENUM('custom', 'page', 'post', 'product', 'collection', 'category');
  CREATE TYPE "public"."enum_footer_social_links_link_type" AS ENUM('custom', 'page', 'post', 'product', 'collection', 'category');
  CREATE TYPE "public"."enum_footer_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__footer_v_version_columns_links_link_type" AS ENUM('custom', 'page', 'post', 'product', 'collection', 'category');
  CREATE TYPE "public"."enum__footer_v_version_social_links_link_type" AS ENUM('custom', 'page', 'post', 'product', 'collection', 'category');
  CREATE TYPE "public"."enum__footer_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"role" "enum_users_role" DEFAULT 'editor' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"caption" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "pages_blocks_hero_banner_actions" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_pages_blocks_hero_banner_actions_link_type" DEFAULT 'custom',
  	"link_label" varchar,
  	"link_url" varchar,
  	"link_page_slug" varchar,
  	"link_post_slug" varchar,
  	"link_product_handle" varchar,
  	"link_collection_handle" varchar,
  	"link_category_handle" varchar,
  	"link_new_tab" boolean DEFAULT false
  );
  
  CREATE TABLE "pages_blocks_hero_banner" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"body" varchar,
  	"background_image_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_rich_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"content" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_image_text_actions" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_pages_blocks_image_text_actions_link_type" DEFAULT 'custom',
  	"link_label" varchar,
  	"link_url" varchar,
  	"link_page_slug" varchar,
  	"link_post_slug" varchar,
  	"link_product_handle" varchar,
  	"link_collection_handle" varchar,
  	"link_category_handle" varchar,
  	"link_new_tab" boolean DEFAULT false
  );
  
  CREATE TABLE "pages_blocks_image_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"layout" "enum_pages_blocks_image_text_layout" DEFAULT 'imageLeft',
  	"image_id" integer,
  	"title" varchar,
  	"body" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_cta_section_actions" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_pages_blocks_cta_section_actions_link_type" DEFAULT 'custom',
  	"link_label" varchar,
  	"link_url" varchar,
  	"link_page_slug" varchar,
  	"link_post_slug" varchar,
  	"link_product_handle" varchar,
  	"link_collection_handle" varchar,
  	"link_category_handle" varchar,
  	"link_new_tab" boolean DEFAULT false
  );
  
  CREATE TABLE "pages_blocks_cta_section" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" varchar,
  	"theme" "enum_pages_blocks_cta_section_theme" DEFAULT 'default',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" jsonb
  );
  
  CREATE TABLE "pages_blocks_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"page_type" "enum_pages_page_type" DEFAULT 'marketing',
  	"excerpt" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_pages_v_blocks_hero_banner_actions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"link_type" "enum__pages_v_blocks_hero_banner_actions_link_type" DEFAULT 'custom',
  	"link_label" varchar,
  	"link_url" varchar,
  	"link_page_slug" varchar,
  	"link_post_slug" varchar,
  	"link_product_handle" varchar,
  	"link_collection_handle" varchar,
  	"link_category_handle" varchar,
  	"link_new_tab" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_hero_banner" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"body" varchar,
  	"background_image_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_rich_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"content" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_image_text_actions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"link_type" "enum__pages_v_blocks_image_text_actions_link_type" DEFAULT 'custom',
  	"link_label" varchar,
  	"link_url" varchar,
  	"link_page_slug" varchar,
  	"link_post_slug" varchar,
  	"link_product_handle" varchar,
  	"link_collection_handle" varchar,
  	"link_category_handle" varchar,
  	"link_new_tab" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_image_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"layout" "enum__pages_v_blocks_image_text_layout" DEFAULT 'imageLeft',
  	"image_id" integer,
  	"title" varchar,
  	"body" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_cta_section_actions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"link_type" "enum__pages_v_blocks_cta_section_actions_link_type" DEFAULT 'custom',
  	"link_label" varchar,
  	"link_url" varchar,
  	"link_page_slug" varchar,
  	"link_post_slug" varchar,
  	"link_product_handle" varchar,
  	"link_collection_handle" varchar,
  	"link_category_handle" varchar,
  	"link_new_tab" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_cta_section" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" varchar,
  	"theme" "enum__pages_v_blocks_cta_section_theme" DEFAULT 'default',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" jsonb,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_page_type" "enum__pages_v_version_page_type" DEFAULT 'marketing',
  	"version_excerpt" varchar,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_seo_image_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "posts_blocks_hero_banner_actions" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_posts_blocks_hero_banner_actions_link_type" DEFAULT 'custom',
  	"link_label" varchar,
  	"link_url" varchar,
  	"link_page_slug" varchar,
  	"link_post_slug" varchar,
  	"link_product_handle" varchar,
  	"link_collection_handle" varchar,
  	"link_category_handle" varchar,
  	"link_new_tab" boolean DEFAULT false
  );
  
  CREATE TABLE "posts_blocks_hero_banner" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"body" varchar,
  	"background_image_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "posts_blocks_rich_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"content" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "posts_blocks_image_text_actions" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_posts_blocks_image_text_actions_link_type" DEFAULT 'custom',
  	"link_label" varchar,
  	"link_url" varchar,
  	"link_page_slug" varchar,
  	"link_post_slug" varchar,
  	"link_product_handle" varchar,
  	"link_collection_handle" varchar,
  	"link_category_handle" varchar,
  	"link_new_tab" boolean DEFAULT false
  );
  
  CREATE TABLE "posts_blocks_image_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"layout" "enum_posts_blocks_image_text_layout" DEFAULT 'imageLeft',
  	"image_id" integer,
  	"title" varchar,
  	"body" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "posts_blocks_cta_section_actions" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_posts_blocks_cta_section_actions_link_type" DEFAULT 'custom',
  	"link_label" varchar,
  	"link_url" varchar,
  	"link_page_slug" varchar,
  	"link_post_slug" varchar,
  	"link_product_handle" varchar,
  	"link_collection_handle" varchar,
  	"link_category_handle" varchar,
  	"link_new_tab" boolean DEFAULT false
  );
  
  CREATE TABLE "posts_blocks_cta_section" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" varchar,
  	"theme" "enum_posts_blocks_cta_section_theme" DEFAULT 'default',
  	"block_name" varchar
  );
  
  CREATE TABLE "posts_blocks_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" jsonb
  );
  
  CREATE TABLE "posts_blocks_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"excerpt" varchar,
  	"published_at" timestamp(3) with time zone,
  	"cover_image_id" integer,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_posts_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_posts_v_blocks_hero_banner_actions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"link_type" "enum__posts_v_blocks_hero_banner_actions_link_type" DEFAULT 'custom',
  	"link_label" varchar,
  	"link_url" varchar,
  	"link_page_slug" varchar,
  	"link_post_slug" varchar,
  	"link_product_handle" varchar,
  	"link_collection_handle" varchar,
  	"link_category_handle" varchar,
  	"link_new_tab" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_posts_v_blocks_hero_banner" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"body" varchar,
  	"background_image_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_posts_v_blocks_rich_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"content" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_posts_v_blocks_image_text_actions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"link_type" "enum__posts_v_blocks_image_text_actions_link_type" DEFAULT 'custom',
  	"link_label" varchar,
  	"link_url" varchar,
  	"link_page_slug" varchar,
  	"link_post_slug" varchar,
  	"link_product_handle" varchar,
  	"link_collection_handle" varchar,
  	"link_category_handle" varchar,
  	"link_new_tab" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_posts_v_blocks_image_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"layout" "enum__posts_v_blocks_image_text_layout" DEFAULT 'imageLeft',
  	"image_id" integer,
  	"title" varchar,
  	"body" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_posts_v_blocks_cta_section_actions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"link_type" "enum__posts_v_blocks_cta_section_actions_link_type" DEFAULT 'custom',
  	"link_label" varchar,
  	"link_url" varchar,
  	"link_page_slug" varchar,
  	"link_post_slug" varchar,
  	"link_product_handle" varchar,
  	"link_collection_handle" varchar,
  	"link_category_handle" varchar,
  	"link_new_tab" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_posts_v_blocks_cta_section" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" varchar,
  	"theme" "enum__posts_v_blocks_cta_section_theme" DEFAULT 'default',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_posts_v_blocks_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" jsonb,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_posts_v_blocks_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_posts_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_excerpt" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_cover_image_id" integer,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_seo_image_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__posts_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"pages_id" integer,
  	"posts_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_name" varchar,
  	"tagline" varchar,
  	"logo_id" integer,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_image_id" integer,
  	"_status" "enum_site_settings_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_site_settings_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_site_name" varchar,
  	"version_tagline" varchar,
  	"version_logo_id" integer,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_seo_image_id" integer,
  	"version__status" "enum__site_settings_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "navigation_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_navigation_items_link_type" DEFAULT 'custom',
  	"link_label" varchar,
  	"link_url" varchar,
  	"link_page_slug" varchar,
  	"link_post_slug" varchar,
  	"link_product_handle" varchar,
  	"link_collection_handle" varchar,
  	"link_category_handle" varchar,
  	"link_new_tab" boolean DEFAULT false
  );
  
  CREATE TABLE "navigation" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"_status" "enum_navigation_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_navigation_v_version_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"link_type" "enum__navigation_v_version_items_link_type" DEFAULT 'custom',
  	"link_label" varchar,
  	"link_url" varchar,
  	"link_page_slug" varchar,
  	"link_post_slug" varchar,
  	"link_product_handle" varchar,
  	"link_collection_handle" varchar,
  	"link_category_handle" varchar,
  	"link_new_tab" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_navigation_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version__status" "enum__navigation_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "footer_columns_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_footer_columns_links_link_type" DEFAULT 'custom',
  	"link_label" varchar,
  	"link_url" varchar,
  	"link_page_slug" varchar,
  	"link_post_slug" varchar,
  	"link_product_handle" varchar,
  	"link_collection_handle" varchar,
  	"link_category_handle" varchar,
  	"link_new_tab" boolean DEFAULT false
  );
  
  CREATE TABLE "footer_columns" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar
  );
  
  CREATE TABLE "footer_social_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_footer_social_links_link_type" DEFAULT 'custom',
  	"link_label" varchar,
  	"link_url" varchar,
  	"link_page_slug" varchar,
  	"link_post_slug" varchar,
  	"link_product_handle" varchar,
  	"link_collection_handle" varchar,
  	"link_category_handle" varchar,
  	"link_new_tab" boolean DEFAULT false
  );
  
  CREATE TABLE "footer" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"contact_email" varchar,
  	"contact_phone" varchar,
  	"_status" "enum_footer_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_footer_v_version_columns_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"link_type" "enum__footer_v_version_columns_links_link_type" DEFAULT 'custom',
  	"link_label" varchar,
  	"link_url" varchar,
  	"link_page_slug" varchar,
  	"link_post_slug" varchar,
  	"link_product_handle" varchar,
  	"link_collection_handle" varchar,
  	"link_category_handle" varchar,
  	"link_new_tab" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_footer_v_version_columns" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_footer_v_version_social_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"link_type" "enum__footer_v_version_social_links_link_type" DEFAULT 'custom',
  	"link_label" varchar,
  	"link_url" varchar,
  	"link_page_slug" varchar,
  	"link_post_slug" varchar,
  	"link_product_handle" varchar,
  	"link_collection_handle" varchar,
  	"link_category_handle" varchar,
  	"link_new_tab" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_footer_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_contact_email" varchar,
  	"version_contact_phone" varchar,
  	"version__status" "enum__footer_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_banner_actions" ADD CONSTRAINT "pages_blocks_hero_banner_actions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_hero_banner"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_banner" ADD CONSTRAINT "pages_blocks_hero_banner_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_banner" ADD CONSTRAINT "pages_blocks_hero_banner_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_rich_text" ADD CONSTRAINT "pages_blocks_rich_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_image_text_actions" ADD CONSTRAINT "pages_blocks_image_text_actions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_image_text"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_image_text" ADD CONSTRAINT "pages_blocks_image_text_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_image_text" ADD CONSTRAINT "pages_blocks_image_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_cta_section_actions" ADD CONSTRAINT "pages_blocks_cta_section_actions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_cta_section"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_cta_section" ADD CONSTRAINT "pages_blocks_cta_section_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_faq_items" ADD CONSTRAINT "pages_blocks_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_faq"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_faq" ADD CONSTRAINT "pages_blocks_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_seo_image_id_media_id_fk" FOREIGN KEY ("seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero_banner_actions" ADD CONSTRAINT "_pages_v_blocks_hero_banner_actions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_hero_banner"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero_banner" ADD CONSTRAINT "_pages_v_blocks_hero_banner_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero_banner" ADD CONSTRAINT "_pages_v_blocks_hero_banner_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_rich_text" ADD CONSTRAINT "_pages_v_blocks_rich_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_image_text_actions" ADD CONSTRAINT "_pages_v_blocks_image_text_actions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_image_text"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_image_text" ADD CONSTRAINT "_pages_v_blocks_image_text_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_image_text" ADD CONSTRAINT "_pages_v_blocks_image_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_cta_section_actions" ADD CONSTRAINT "_pages_v_blocks_cta_section_actions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_cta_section"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_cta_section" ADD CONSTRAINT "_pages_v_blocks_cta_section_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_faq_items" ADD CONSTRAINT "_pages_v_blocks_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_faq"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_faq" ADD CONSTRAINT "_pages_v_blocks_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_seo_image_id_media_id_fk" FOREIGN KEY ("version_seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts_blocks_hero_banner_actions" ADD CONSTRAINT "posts_blocks_hero_banner_actions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts_blocks_hero_banner"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_blocks_hero_banner" ADD CONSTRAINT "posts_blocks_hero_banner_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts_blocks_hero_banner" ADD CONSTRAINT "posts_blocks_hero_banner_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_blocks_rich_text" ADD CONSTRAINT "posts_blocks_rich_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_blocks_image_text_actions" ADD CONSTRAINT "posts_blocks_image_text_actions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts_blocks_image_text"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_blocks_image_text" ADD CONSTRAINT "posts_blocks_image_text_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts_blocks_image_text" ADD CONSTRAINT "posts_blocks_image_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_blocks_cta_section_actions" ADD CONSTRAINT "posts_blocks_cta_section_actions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts_blocks_cta_section"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_blocks_cta_section" ADD CONSTRAINT "posts_blocks_cta_section_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_blocks_faq_items" ADD CONSTRAINT "posts_blocks_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts_blocks_faq"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_blocks_faq" ADD CONSTRAINT "posts_blocks_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_seo_image_id_media_id_fk" FOREIGN KEY ("seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_hero_banner_actions" ADD CONSTRAINT "_posts_v_blocks_hero_banner_actions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v_blocks_hero_banner"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_hero_banner" ADD CONSTRAINT "_posts_v_blocks_hero_banner_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_hero_banner" ADD CONSTRAINT "_posts_v_blocks_hero_banner_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_rich_text" ADD CONSTRAINT "_posts_v_blocks_rich_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_image_text_actions" ADD CONSTRAINT "_posts_v_blocks_image_text_actions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v_blocks_image_text"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_image_text" ADD CONSTRAINT "_posts_v_blocks_image_text_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_image_text" ADD CONSTRAINT "_posts_v_blocks_image_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_cta_section_actions" ADD CONSTRAINT "_posts_v_blocks_cta_section_actions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v_blocks_cta_section"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_cta_section" ADD CONSTRAINT "_posts_v_blocks_cta_section_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_faq_items" ADD CONSTRAINT "_posts_v_blocks_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v_blocks_faq"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_faq" ADD CONSTRAINT "_posts_v_blocks_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_parent_id_posts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_seo_image_id_media_id_fk" FOREIGN KEY ("version_seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_seo_image_id_media_id_fk" FOREIGN KEY ("seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_site_settings_v" ADD CONSTRAINT "_site_settings_v_version_logo_id_media_id_fk" FOREIGN KEY ("version_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_site_settings_v" ADD CONSTRAINT "_site_settings_v_version_seo_image_id_media_id_fk" FOREIGN KEY ("version_seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."navigation"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_navigation_v_version_items" ADD CONSTRAINT "_navigation_v_version_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_navigation_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_columns_links" ADD CONSTRAINT "footer_columns_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer_columns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_columns" ADD CONSTRAINT "footer_columns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_social_links" ADD CONSTRAINT "footer_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_footer_v_version_columns_links" ADD CONSTRAINT "_footer_v_version_columns_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_footer_v_version_columns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_footer_v_version_columns" ADD CONSTRAINT "_footer_v_version_columns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_footer_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_footer_v_version_social_links" ADD CONSTRAINT "_footer_v_version_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_footer_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "pages_blocks_hero_banner_actions_order_idx" ON "pages_blocks_hero_banner_actions" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_banner_actions_parent_id_idx" ON "pages_blocks_hero_banner_actions" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_banner_order_idx" ON "pages_blocks_hero_banner" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_banner_parent_id_idx" ON "pages_blocks_hero_banner" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_banner_path_idx" ON "pages_blocks_hero_banner" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_banner_background_image_idx" ON "pages_blocks_hero_banner" USING btree ("background_image_id");
  CREATE INDEX "pages_blocks_rich_text_order_idx" ON "pages_blocks_rich_text" USING btree ("_order");
  CREATE INDEX "pages_blocks_rich_text_parent_id_idx" ON "pages_blocks_rich_text" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_rich_text_path_idx" ON "pages_blocks_rich_text" USING btree ("_path");
  CREATE INDEX "pages_blocks_image_text_actions_order_idx" ON "pages_blocks_image_text_actions" USING btree ("_order");
  CREATE INDEX "pages_blocks_image_text_actions_parent_id_idx" ON "pages_blocks_image_text_actions" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_image_text_order_idx" ON "pages_blocks_image_text" USING btree ("_order");
  CREATE INDEX "pages_blocks_image_text_parent_id_idx" ON "pages_blocks_image_text" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_image_text_path_idx" ON "pages_blocks_image_text" USING btree ("_path");
  CREATE INDEX "pages_blocks_image_text_image_idx" ON "pages_blocks_image_text" USING btree ("image_id");
  CREATE INDEX "pages_blocks_cta_section_actions_order_idx" ON "pages_blocks_cta_section_actions" USING btree ("_order");
  CREATE INDEX "pages_blocks_cta_section_actions_parent_id_idx" ON "pages_blocks_cta_section_actions" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_cta_section_order_idx" ON "pages_blocks_cta_section" USING btree ("_order");
  CREATE INDEX "pages_blocks_cta_section_parent_id_idx" ON "pages_blocks_cta_section" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_cta_section_path_idx" ON "pages_blocks_cta_section" USING btree ("_path");
  CREATE INDEX "pages_blocks_faq_items_order_idx" ON "pages_blocks_faq_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_faq_items_parent_id_idx" ON "pages_blocks_faq_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_faq_order_idx" ON "pages_blocks_faq" USING btree ("_order");
  CREATE INDEX "pages_blocks_faq_parent_id_idx" ON "pages_blocks_faq" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_faq_path_idx" ON "pages_blocks_faq" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE INDEX "pages_seo_seo_image_idx" ON "pages" USING btree ("seo_image_id");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "pages__status_idx" ON "pages" USING btree ("_status");
  CREATE INDEX "_pages_v_blocks_hero_banner_actions_order_idx" ON "_pages_v_blocks_hero_banner_actions" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_hero_banner_actions_parent_id_idx" ON "_pages_v_blocks_hero_banner_actions" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_hero_banner_order_idx" ON "_pages_v_blocks_hero_banner" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_hero_banner_parent_id_idx" ON "_pages_v_blocks_hero_banner" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_hero_banner_path_idx" ON "_pages_v_blocks_hero_banner" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_hero_banner_background_image_idx" ON "_pages_v_blocks_hero_banner" USING btree ("background_image_id");
  CREATE INDEX "_pages_v_blocks_rich_text_order_idx" ON "_pages_v_blocks_rich_text" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_rich_text_parent_id_idx" ON "_pages_v_blocks_rich_text" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_rich_text_path_idx" ON "_pages_v_blocks_rich_text" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_image_text_actions_order_idx" ON "_pages_v_blocks_image_text_actions" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_image_text_actions_parent_id_idx" ON "_pages_v_blocks_image_text_actions" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_image_text_order_idx" ON "_pages_v_blocks_image_text" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_image_text_parent_id_idx" ON "_pages_v_blocks_image_text" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_image_text_path_idx" ON "_pages_v_blocks_image_text" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_image_text_image_idx" ON "_pages_v_blocks_image_text" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_cta_section_actions_order_idx" ON "_pages_v_blocks_cta_section_actions" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_cta_section_actions_parent_id_idx" ON "_pages_v_blocks_cta_section_actions" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_cta_section_order_idx" ON "_pages_v_blocks_cta_section" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_cta_section_parent_id_idx" ON "_pages_v_blocks_cta_section" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_cta_section_path_idx" ON "_pages_v_blocks_cta_section" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_faq_items_order_idx" ON "_pages_v_blocks_faq_items" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_faq_items_parent_id_idx" ON "_pages_v_blocks_faq_items" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_faq_order_idx" ON "_pages_v_blocks_faq" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_faq_parent_id_idx" ON "_pages_v_blocks_faq" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_faq_path_idx" ON "_pages_v_blocks_faq" USING btree ("_path");
  CREATE INDEX "_pages_v_parent_idx" ON "_pages_v" USING btree ("parent_id");
  CREATE INDEX "_pages_v_version_version_slug_idx" ON "_pages_v" USING btree ("version_slug");
  CREATE INDEX "_pages_v_version_seo_version_seo_image_idx" ON "_pages_v" USING btree ("version_seo_image_id");
  CREATE INDEX "_pages_v_version_version_updated_at_idx" ON "_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_pages_v_version_version_created_at_idx" ON "_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_pages_v_version_version__status_idx" ON "_pages_v" USING btree ("version__status");
  CREATE INDEX "_pages_v_created_at_idx" ON "_pages_v" USING btree ("created_at");
  CREATE INDEX "_pages_v_updated_at_idx" ON "_pages_v" USING btree ("updated_at");
  CREATE INDEX "_pages_v_latest_idx" ON "_pages_v" USING btree ("latest");
  CREATE INDEX "posts_blocks_hero_banner_actions_order_idx" ON "posts_blocks_hero_banner_actions" USING btree ("_order");
  CREATE INDEX "posts_blocks_hero_banner_actions_parent_id_idx" ON "posts_blocks_hero_banner_actions" USING btree ("_parent_id");
  CREATE INDEX "posts_blocks_hero_banner_order_idx" ON "posts_blocks_hero_banner" USING btree ("_order");
  CREATE INDEX "posts_blocks_hero_banner_parent_id_idx" ON "posts_blocks_hero_banner" USING btree ("_parent_id");
  CREATE INDEX "posts_blocks_hero_banner_path_idx" ON "posts_blocks_hero_banner" USING btree ("_path");
  CREATE INDEX "posts_blocks_hero_banner_background_image_idx" ON "posts_blocks_hero_banner" USING btree ("background_image_id");
  CREATE INDEX "posts_blocks_rich_text_order_idx" ON "posts_blocks_rich_text" USING btree ("_order");
  CREATE INDEX "posts_blocks_rich_text_parent_id_idx" ON "posts_blocks_rich_text" USING btree ("_parent_id");
  CREATE INDEX "posts_blocks_rich_text_path_idx" ON "posts_blocks_rich_text" USING btree ("_path");
  CREATE INDEX "posts_blocks_image_text_actions_order_idx" ON "posts_blocks_image_text_actions" USING btree ("_order");
  CREATE INDEX "posts_blocks_image_text_actions_parent_id_idx" ON "posts_blocks_image_text_actions" USING btree ("_parent_id");
  CREATE INDEX "posts_blocks_image_text_order_idx" ON "posts_blocks_image_text" USING btree ("_order");
  CREATE INDEX "posts_blocks_image_text_parent_id_idx" ON "posts_blocks_image_text" USING btree ("_parent_id");
  CREATE INDEX "posts_blocks_image_text_path_idx" ON "posts_blocks_image_text" USING btree ("_path");
  CREATE INDEX "posts_blocks_image_text_image_idx" ON "posts_blocks_image_text" USING btree ("image_id");
  CREATE INDEX "posts_blocks_cta_section_actions_order_idx" ON "posts_blocks_cta_section_actions" USING btree ("_order");
  CREATE INDEX "posts_blocks_cta_section_actions_parent_id_idx" ON "posts_blocks_cta_section_actions" USING btree ("_parent_id");
  CREATE INDEX "posts_blocks_cta_section_order_idx" ON "posts_blocks_cta_section" USING btree ("_order");
  CREATE INDEX "posts_blocks_cta_section_parent_id_idx" ON "posts_blocks_cta_section" USING btree ("_parent_id");
  CREATE INDEX "posts_blocks_cta_section_path_idx" ON "posts_blocks_cta_section" USING btree ("_path");
  CREATE INDEX "posts_blocks_faq_items_order_idx" ON "posts_blocks_faq_items" USING btree ("_order");
  CREATE INDEX "posts_blocks_faq_items_parent_id_idx" ON "posts_blocks_faq_items" USING btree ("_parent_id");
  CREATE INDEX "posts_blocks_faq_order_idx" ON "posts_blocks_faq" USING btree ("_order");
  CREATE INDEX "posts_blocks_faq_parent_id_idx" ON "posts_blocks_faq" USING btree ("_parent_id");
  CREATE INDEX "posts_blocks_faq_path_idx" ON "posts_blocks_faq" USING btree ("_path");
  CREATE UNIQUE INDEX "posts_slug_idx" ON "posts" USING btree ("slug");
  CREATE INDEX "posts_cover_image_idx" ON "posts" USING btree ("cover_image_id");
  CREATE INDEX "posts_seo_seo_image_idx" ON "posts" USING btree ("seo_image_id");
  CREATE INDEX "posts_updated_at_idx" ON "posts" USING btree ("updated_at");
  CREATE INDEX "posts_created_at_idx" ON "posts" USING btree ("created_at");
  CREATE INDEX "posts__status_idx" ON "posts" USING btree ("_status");
  CREATE INDEX "_posts_v_blocks_hero_banner_actions_order_idx" ON "_posts_v_blocks_hero_banner_actions" USING btree ("_order");
  CREATE INDEX "_posts_v_blocks_hero_banner_actions_parent_id_idx" ON "_posts_v_blocks_hero_banner_actions" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_blocks_hero_banner_order_idx" ON "_posts_v_blocks_hero_banner" USING btree ("_order");
  CREATE INDEX "_posts_v_blocks_hero_banner_parent_id_idx" ON "_posts_v_blocks_hero_banner" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_blocks_hero_banner_path_idx" ON "_posts_v_blocks_hero_banner" USING btree ("_path");
  CREATE INDEX "_posts_v_blocks_hero_banner_background_image_idx" ON "_posts_v_blocks_hero_banner" USING btree ("background_image_id");
  CREATE INDEX "_posts_v_blocks_rich_text_order_idx" ON "_posts_v_blocks_rich_text" USING btree ("_order");
  CREATE INDEX "_posts_v_blocks_rich_text_parent_id_idx" ON "_posts_v_blocks_rich_text" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_blocks_rich_text_path_idx" ON "_posts_v_blocks_rich_text" USING btree ("_path");
  CREATE INDEX "_posts_v_blocks_image_text_actions_order_idx" ON "_posts_v_blocks_image_text_actions" USING btree ("_order");
  CREATE INDEX "_posts_v_blocks_image_text_actions_parent_id_idx" ON "_posts_v_blocks_image_text_actions" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_blocks_image_text_order_idx" ON "_posts_v_blocks_image_text" USING btree ("_order");
  CREATE INDEX "_posts_v_blocks_image_text_parent_id_idx" ON "_posts_v_blocks_image_text" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_blocks_image_text_path_idx" ON "_posts_v_blocks_image_text" USING btree ("_path");
  CREATE INDEX "_posts_v_blocks_image_text_image_idx" ON "_posts_v_blocks_image_text" USING btree ("image_id");
  CREATE INDEX "_posts_v_blocks_cta_section_actions_order_idx" ON "_posts_v_blocks_cta_section_actions" USING btree ("_order");
  CREATE INDEX "_posts_v_blocks_cta_section_actions_parent_id_idx" ON "_posts_v_blocks_cta_section_actions" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_blocks_cta_section_order_idx" ON "_posts_v_blocks_cta_section" USING btree ("_order");
  CREATE INDEX "_posts_v_blocks_cta_section_parent_id_idx" ON "_posts_v_blocks_cta_section" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_blocks_cta_section_path_idx" ON "_posts_v_blocks_cta_section" USING btree ("_path");
  CREATE INDEX "_posts_v_blocks_faq_items_order_idx" ON "_posts_v_blocks_faq_items" USING btree ("_order");
  CREATE INDEX "_posts_v_blocks_faq_items_parent_id_idx" ON "_posts_v_blocks_faq_items" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_blocks_faq_order_idx" ON "_posts_v_blocks_faq" USING btree ("_order");
  CREATE INDEX "_posts_v_blocks_faq_parent_id_idx" ON "_posts_v_blocks_faq" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_blocks_faq_path_idx" ON "_posts_v_blocks_faq" USING btree ("_path");
  CREATE INDEX "_posts_v_parent_idx" ON "_posts_v" USING btree ("parent_id");
  CREATE INDEX "_posts_v_version_version_slug_idx" ON "_posts_v" USING btree ("version_slug");
  CREATE INDEX "_posts_v_version_version_cover_image_idx" ON "_posts_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_posts_v_version_seo_version_seo_image_idx" ON "_posts_v" USING btree ("version_seo_image_id");
  CREATE INDEX "_posts_v_version_version_updated_at_idx" ON "_posts_v" USING btree ("version_updated_at");
  CREATE INDEX "_posts_v_version_version_created_at_idx" ON "_posts_v" USING btree ("version_created_at");
  CREATE INDEX "_posts_v_version_version__status_idx" ON "_posts_v" USING btree ("version__status");
  CREATE INDEX "_posts_v_created_at_idx" ON "_posts_v" USING btree ("created_at");
  CREATE INDEX "_posts_v_updated_at_idx" ON "_posts_v" USING btree ("updated_at");
  CREATE INDEX "_posts_v_latest_idx" ON "_posts_v" USING btree ("latest");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_posts_id_idx" ON "payload_locked_documents_rels" USING btree ("posts_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "site_settings_logo_idx" ON "site_settings" USING btree ("logo_id");
  CREATE INDEX "site_settings_seo_seo_image_idx" ON "site_settings" USING btree ("seo_image_id");
  CREATE INDEX "site_settings__status_idx" ON "site_settings" USING btree ("_status");
  CREATE INDEX "_site_settings_v_version_version_logo_idx" ON "_site_settings_v" USING btree ("version_logo_id");
  CREATE INDEX "_site_settings_v_version_seo_version_seo_image_idx" ON "_site_settings_v" USING btree ("version_seo_image_id");
  CREATE INDEX "_site_settings_v_version_version__status_idx" ON "_site_settings_v" USING btree ("version__status");
  CREATE INDEX "_site_settings_v_created_at_idx" ON "_site_settings_v" USING btree ("created_at");
  CREATE INDEX "_site_settings_v_updated_at_idx" ON "_site_settings_v" USING btree ("updated_at");
  CREATE INDEX "_site_settings_v_latest_idx" ON "_site_settings_v" USING btree ("latest");
  CREATE INDEX "navigation_items_order_idx" ON "navigation_items" USING btree ("_order");
  CREATE INDEX "navigation_items_parent_id_idx" ON "navigation_items" USING btree ("_parent_id");
  CREATE INDEX "navigation__status_idx" ON "navigation" USING btree ("_status");
  CREATE INDEX "_navigation_v_version_items_order_idx" ON "_navigation_v_version_items" USING btree ("_order");
  CREATE INDEX "_navigation_v_version_items_parent_id_idx" ON "_navigation_v_version_items" USING btree ("_parent_id");
  CREATE INDEX "_navigation_v_version_version__status_idx" ON "_navigation_v" USING btree ("version__status");
  CREATE INDEX "_navigation_v_created_at_idx" ON "_navigation_v" USING btree ("created_at");
  CREATE INDEX "_navigation_v_updated_at_idx" ON "_navigation_v" USING btree ("updated_at");
  CREATE INDEX "_navigation_v_latest_idx" ON "_navigation_v" USING btree ("latest");
  CREATE INDEX "footer_columns_links_order_idx" ON "footer_columns_links" USING btree ("_order");
  CREATE INDEX "footer_columns_links_parent_id_idx" ON "footer_columns_links" USING btree ("_parent_id");
  CREATE INDEX "footer_columns_order_idx" ON "footer_columns" USING btree ("_order");
  CREATE INDEX "footer_columns_parent_id_idx" ON "footer_columns" USING btree ("_parent_id");
  CREATE INDEX "footer_social_links_order_idx" ON "footer_social_links" USING btree ("_order");
  CREATE INDEX "footer_social_links_parent_id_idx" ON "footer_social_links" USING btree ("_parent_id");
  CREATE INDEX "footer__status_idx" ON "footer" USING btree ("_status");
  CREATE INDEX "_footer_v_version_columns_links_order_idx" ON "_footer_v_version_columns_links" USING btree ("_order");
  CREATE INDEX "_footer_v_version_columns_links_parent_id_idx" ON "_footer_v_version_columns_links" USING btree ("_parent_id");
  CREATE INDEX "_footer_v_version_columns_order_idx" ON "_footer_v_version_columns" USING btree ("_order");
  CREATE INDEX "_footer_v_version_columns_parent_id_idx" ON "_footer_v_version_columns" USING btree ("_parent_id");
  CREATE INDEX "_footer_v_version_social_links_order_idx" ON "_footer_v_version_social_links" USING btree ("_order");
  CREATE INDEX "_footer_v_version_social_links_parent_id_idx" ON "_footer_v_version_social_links" USING btree ("_parent_id");
  CREATE INDEX "_footer_v_version_version__status_idx" ON "_footer_v" USING btree ("version__status");
  CREATE INDEX "_footer_v_created_at_idx" ON "_footer_v" USING btree ("created_at");
  CREATE INDEX "_footer_v_updated_at_idx" ON "_footer_v" USING btree ("updated_at");
  CREATE INDEX "_footer_v_latest_idx" ON "_footer_v" USING btree ("latest");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "pages_blocks_hero_banner_actions" CASCADE;
  DROP TABLE "pages_blocks_hero_banner" CASCADE;
  DROP TABLE "pages_blocks_rich_text" CASCADE;
  DROP TABLE "pages_blocks_image_text_actions" CASCADE;
  DROP TABLE "pages_blocks_image_text" CASCADE;
  DROP TABLE "pages_blocks_cta_section_actions" CASCADE;
  DROP TABLE "pages_blocks_cta_section" CASCADE;
  DROP TABLE "pages_blocks_faq_items" CASCADE;
  DROP TABLE "pages_blocks_faq" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "_pages_v_blocks_hero_banner_actions" CASCADE;
  DROP TABLE "_pages_v_blocks_hero_banner" CASCADE;
  DROP TABLE "_pages_v_blocks_rich_text" CASCADE;
  DROP TABLE "_pages_v_blocks_image_text_actions" CASCADE;
  DROP TABLE "_pages_v_blocks_image_text" CASCADE;
  DROP TABLE "_pages_v_blocks_cta_section_actions" CASCADE;
  DROP TABLE "_pages_v_blocks_cta_section" CASCADE;
  DROP TABLE "_pages_v_blocks_faq_items" CASCADE;
  DROP TABLE "_pages_v_blocks_faq" CASCADE;
  DROP TABLE "_pages_v" CASCADE;
  DROP TABLE "posts_blocks_hero_banner_actions" CASCADE;
  DROP TABLE "posts_blocks_hero_banner" CASCADE;
  DROP TABLE "posts_blocks_rich_text" CASCADE;
  DROP TABLE "posts_blocks_image_text_actions" CASCADE;
  DROP TABLE "posts_blocks_image_text" CASCADE;
  DROP TABLE "posts_blocks_cta_section_actions" CASCADE;
  DROP TABLE "posts_blocks_cta_section" CASCADE;
  DROP TABLE "posts_blocks_faq_items" CASCADE;
  DROP TABLE "posts_blocks_faq" CASCADE;
  DROP TABLE "posts" CASCADE;
  DROP TABLE "_posts_v_blocks_hero_banner_actions" CASCADE;
  DROP TABLE "_posts_v_blocks_hero_banner" CASCADE;
  DROP TABLE "_posts_v_blocks_rich_text" CASCADE;
  DROP TABLE "_posts_v_blocks_image_text_actions" CASCADE;
  DROP TABLE "_posts_v_blocks_image_text" CASCADE;
  DROP TABLE "_posts_v_blocks_cta_section_actions" CASCADE;
  DROP TABLE "_posts_v_blocks_cta_section" CASCADE;
  DROP TABLE "_posts_v_blocks_faq_items" CASCADE;
  DROP TABLE "_posts_v_blocks_faq" CASCADE;
  DROP TABLE "_posts_v" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "site_settings" CASCADE;
  DROP TABLE "_site_settings_v" CASCADE;
  DROP TABLE "navigation_items" CASCADE;
  DROP TABLE "navigation" CASCADE;
  DROP TABLE "_navigation_v_version_items" CASCADE;
  DROP TABLE "_navigation_v" CASCADE;
  DROP TABLE "footer_columns_links" CASCADE;
  DROP TABLE "footer_columns" CASCADE;
  DROP TABLE "footer_social_links" CASCADE;
  DROP TABLE "footer" CASCADE;
  DROP TABLE "_footer_v_version_columns_links" CASCADE;
  DROP TABLE "_footer_v_version_columns" CASCADE;
  DROP TABLE "_footer_v_version_social_links" CASCADE;
  DROP TABLE "_footer_v" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_pages_blocks_hero_banner_actions_link_type";
  DROP TYPE "public"."enum_pages_blocks_image_text_actions_link_type";
  DROP TYPE "public"."enum_pages_blocks_image_text_layout";
  DROP TYPE "public"."enum_pages_blocks_cta_section_actions_link_type";
  DROP TYPE "public"."enum_pages_blocks_cta_section_theme";
  DROP TYPE "public"."enum_pages_page_type";
  DROP TYPE "public"."enum_pages_status";
  DROP TYPE "public"."enum__pages_v_blocks_hero_banner_actions_link_type";
  DROP TYPE "public"."enum__pages_v_blocks_image_text_actions_link_type";
  DROP TYPE "public"."enum__pages_v_blocks_image_text_layout";
  DROP TYPE "public"."enum__pages_v_blocks_cta_section_actions_link_type";
  DROP TYPE "public"."enum__pages_v_blocks_cta_section_theme";
  DROP TYPE "public"."enum__pages_v_version_page_type";
  DROP TYPE "public"."enum__pages_v_version_status";
  DROP TYPE "public"."enum_posts_blocks_hero_banner_actions_link_type";
  DROP TYPE "public"."enum_posts_blocks_image_text_actions_link_type";
  DROP TYPE "public"."enum_posts_blocks_image_text_layout";
  DROP TYPE "public"."enum_posts_blocks_cta_section_actions_link_type";
  DROP TYPE "public"."enum_posts_blocks_cta_section_theme";
  DROP TYPE "public"."enum_posts_status";
  DROP TYPE "public"."enum__posts_v_blocks_hero_banner_actions_link_type";
  DROP TYPE "public"."enum__posts_v_blocks_image_text_actions_link_type";
  DROP TYPE "public"."enum__posts_v_blocks_image_text_layout";
  DROP TYPE "public"."enum__posts_v_blocks_cta_section_actions_link_type";
  DROP TYPE "public"."enum__posts_v_blocks_cta_section_theme";
  DROP TYPE "public"."enum__posts_v_version_status";
  DROP TYPE "public"."enum_site_settings_status";
  DROP TYPE "public"."enum__site_settings_v_version_status";
  DROP TYPE "public"."enum_navigation_items_link_type";
  DROP TYPE "public"."enum_navigation_status";
  DROP TYPE "public"."enum__navigation_v_version_items_link_type";
  DROP TYPE "public"."enum__navigation_v_version_status";
  DROP TYPE "public"."enum_footer_columns_links_link_type";
  DROP TYPE "public"."enum_footer_social_links_link_type";
  DROP TYPE "public"."enum_footer_status";
  DROP TYPE "public"."enum__footer_v_version_columns_links_link_type";
  DROP TYPE "public"."enum__footer_v_version_social_links_link_type";
  DROP TYPE "public"."enum__footer_v_version_status";`)
}
