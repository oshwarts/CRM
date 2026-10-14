import { useAuth } from '../context/AuthProvider'

/** deleting a doctor or meeting: a manager, or whoever created it (the database enforces the same rule) */
export function useCanDelete() {
  const { isAdmin, user } = useAuth()
  return (createdBy: string | null | undefined) => isAdmin || (!!createdBy && createdBy === user?.id)
}
