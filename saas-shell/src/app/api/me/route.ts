import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(null, { status: 401 })
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({
    email: user.email,
    plan: subscription?.plan ?? 'free',
    status: subscription?.status === 'free' ? 'Active' : (subscription?.status ?? 'Active'),
  })
}
