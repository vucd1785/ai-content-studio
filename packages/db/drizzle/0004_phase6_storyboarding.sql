-- P6-10: trạng thái dựng storyboard trước cổng script (ADR-014). IF NOT EXISTS để chạy lại không lỗi.
ALTER TYPE "public"."workflow_run_status" ADD VALUE IF NOT EXISTS 'storyboarding' BEFORE 'waiting_script_approval';
