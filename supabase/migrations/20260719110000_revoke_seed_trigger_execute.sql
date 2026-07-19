-- The seed trigger wrapper is only ever invoked by the on_auth_user_created
-- trigger; it must not be callable via the REST RPC surface (advisor lint
-- 0028/0029). seed_finance_categories() itself was already revoked.
revoke execute on function public.handle_new_user_seed_finance_categories() from anon, authenticated, public;
