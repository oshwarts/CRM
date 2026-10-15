// Which robotic systems a company, or a competitor, works with (tables company_robotic_systems / competitor_robotic_systems, migration 061).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

// the tables are newer than the generated types, so this module reads and writes them through an untyped view of the client
const db = supabase as unknown as SupabaseClient

export type RobotOwner = 'company' | 'competitor'

const TABLE = { company: 'company_robotic_systems', competitor: 'competitor_robotic_systems' } as const
const COLUMN = { company: 'company_id', competitor: 'competitor_id' } as const

/** owner id → ids of the robotic systems it works with */
export function useRobotLinks(kind: RobotOwner) {
  return useQuery({
    queryKey: ['robot-links', kind],
    queryFn: async () => {
      const { data, error } = await db.from(TABLE[kind]).select('*')
      if (error) throw error
      const map: Record<string, string[]> = {}
      for (const r of (data ?? []) as Record<string, string>[]) (map[r[COLUMN[kind]]] ??= []).push(r.system_id)
      return map
    },
  })
}

export function useToggleRobotLink(kind: RobotOwner) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ownerId, systemId, on }: { ownerId: string; systemId: string; on: boolean }) => {
      const res = on
        ? await db.from(TABLE[kind]).upsert({ [COLUMN[kind]]: ownerId, system_id: systemId })
        : await db.from(TABLE[kind]).delete().eq(COLUMN[kind], ownerId).eq('system_id', systemId)
      if (res.error) throw res.error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['robot-links', kind] }),
  })
}
