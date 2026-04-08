import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const requestId = String(body.requestId || '').trim();
    const action = String(body.action || '').trim();

    if (!requestId) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }

    if (action !== 'accepted' && action !== 'declined') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: requestRow, error: requestError } = await supabase
      .from('friends')
      .select('*')
      .eq('id', requestId)
      .single();

    if (requestError || !requestRow) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (requestRow.addressee_id !== user.id) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const { error: updateError } = await supabase
      .from('friends')
      .update({
        status: action,
        responded_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Friend response error:', error);
    return NextResponse.json({ error: 'Failed to respond to request' }, { status: 500 });
  }
}