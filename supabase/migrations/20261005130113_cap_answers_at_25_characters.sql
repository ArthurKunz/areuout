-- cap_answers_at_25_characters
--
-- Rollback:
--   ALTER TABLE public.pool_responses DROP CONSTRAINT IF EXISTS pool_responses_text_max_25;
--
-- The question answer is 25 characters in the UI (Question.md §8); until now only the
-- UI held it, the table allowed 5000 (pool_responses_text_length_check, which stays).
-- pool_responses had 0 rows when this was applied.

ALTER TABLE public.pool_responses
  ADD CONSTRAINT pool_responses_text_max_25 CHECK (length(text_response) <= 25);
