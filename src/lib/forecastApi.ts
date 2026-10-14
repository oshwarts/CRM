import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export type UsageRow = { item_id: string; procedure_type: 'knee' | 'uni' | 'hip'; qty_per_case: number }

/** units of each consumable one surgery of a type uses */
export function useConsumableUsage() {
  return useQuery({
    queryKey: ['consumable-usage'],
    queryFn: async () => {
      const { data, error } = await supabase.from('consumable_usage').select('*')
      if (error) throw error
      return (data ?? []) as UsageRow[]
    },
  })
}

export function useSaveUsage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (u: UsageRow) => {
      const q = supabase.from('consumable_usage')
      const { error } = u.qty_per_case > 0 ? await q.upsert(u, { onConflict: 'item_id,procedure_type' }) : await q.delete().eq('item_id', u.item_id).eq('procedure_type', u.procedure_type)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['consumable-usage'] }),
  })
}
