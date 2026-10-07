CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items (order_id);

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats(_start timestamptz, _end timestamptz, _tz text DEFAULT 'Africa/Algiers')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  tz text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  IF _start IS NULL OR _end IS NULL OR _end <= _start THEN
    RAISE EXCEPTION 'Période invalide';
  END IF;
  IF _end - _start > interval '400 days' THEN
    RAISE EXCEPTION 'Période trop longue (400 jours maximum)';
  END IF;
  tz := CASE WHEN EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = _tz) THEN _tz ELSE 'Africa/Algiers' END;

  WITH o AS (
    SELECT id, status, total, product_name, product_price, quantity, wilaya_name, created_at
    FROM public.orders
    WHERE created_at >= _start AND created_at < _end
  ),
  k AS (
    SELECT
      count(*)::int AS orders_count,
      count(*) FILTER (WHERE status <> 'cancelled')::int AS valid_count,
      coalesce(sum(total) FILTER (WHERE status <> 'cancelled'), 0) AS revenue,
      count(*) FILTER (WHERE status IN ('confirmed', 'shipped', 'delivered'))::int AS confirmed_count,
      count(*) FILTER (WHERE status = 'delivered')::int AS delivered_count,
      count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled_count
    FROM o
  ),
  days AS (
    SELECT d::date AS day
    FROM generate_series(
      (_start AT TIME ZONE tz)::date,
      ((_end - interval '1 microsecond') AT TIME ZONE tz)::date,
      interval '1 day'
    ) d
  ),
  daily AS (
    SELECT (created_at AT TIME ZONE tz)::date AS day,
      count(*)::int AS orders,
      coalesce(sum(total) FILTER (WHERE status <> 'cancelled'), 0) AS revenue
    FROM o GROUP BY 1
  ),
  lines AS (
    SELECT coalesce(oi.product_name, o.product_name) AS name,
      oi.quantity AS qty,
      oi.quantity * coalesce(oi.unit_price, o.product_price) AS amount
    FROM o JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.status <> 'cancelled'
    UNION ALL
    SELECT o.product_name, o.quantity, o.product_price * o.quantity
    FROM o
    WHERE o.status <> 'cancelled'
      AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id)
  ),
  tp AS (
    SELECT name, sum(qty)::int AS qty, sum(amount) AS amount
    FROM lines GROUP BY name ORDER BY 2 DESC, 3 DESC LIMIT 5
  ),
  tw AS (
    SELECT wilaya_name AS name, count(*)::int AS orders, coalesce(sum(total), 0) AS amount
    FROM o WHERE status <> 'cancelled'
    GROUP BY wilaya_name ORDER BY 2 DESC, 3 DESC LIMIT 5
  )
  SELECT jsonb_build_object(
    'kpis', (SELECT to_jsonb(k) FROM k),
    'daily', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'day', days.day,
        'orders', coalesce(daily.orders, 0),
        'revenue', coalesce(daily.revenue, 0)
      ) ORDER BY days.day), '[]'::jsonb)
      FROM days LEFT JOIN daily ON daily.day = days.day),
    'top_products', (SELECT coalesce(jsonb_agg(to_jsonb(tp) ORDER BY tp.qty DESC, tp.amount DESC), '[]'::jsonb) FROM tp),
    'top_wilayas', (SELECT coalesce(jsonb_agg(to_jsonb(tw) ORDER BY tw.orders DESC, tw.amount DESC), '[]'::jsonb) FROM tw)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_stats(timestamptz, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_dashboard_stats(timestamptz, timestamptz, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats(timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats(timestamptz, timestamptz, text) TO service_role;