import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend'; // RESEND RESMİ KÜTÜPHANESİ EKLENDİ

// ==========================================
// 1. HTML E-POSTA ŞABLONUMUZ
// ==========================================
const emailTemplate = `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LIFTRIX CORE - Günlük Şube Raporu</title>
</head>
<body style="margin: 0; padding: 0; background-color: #000000; font-family: 'Arial', Helvetica, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #000000; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #09090b; border: 1px solid #27272a; border-radius: 24px; overflow: hidden;">
          <tr>
            <td align="center" style="padding: 40px 30px 30px 30px; border-bottom: 1px solid #18181b;">
              <h1 style="margin: 0; font-size: 36px; font-weight: 900; font-style: italic; letter-spacing: -2px; color: #ffffff; text-transform: uppercase;">
                LIFTRI<span style="color: #facc15;">X</span> <span style="color: #a3e635; margin-left: 5px;">CORE</span>
              </h1>
              <p style="margin: 10px 0 0 0; color: #71717a; font-size: 10px; text-transform: uppercase; letter-spacing: 4px; font-weight: bold;">Günlük Sistem Raporu</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 10px 0; font-size: 20px; color: #ffffff; font-style: italic; text-transform: uppercase; font-weight: 900;">GÜNAYDIN PATRON,</h2>
              <p style="margin: 0 0 30px 0; color: #a1a1aa; font-size: 14px; line-height: 1.6;">İşte <strong style="color: #a3e635;">{{gym_name}}</strong> şubenizin son 24 saatlik finansal ve operasyonel özeti.</p>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="background-color: #18181b; padding: 25px; border-radius: 16px; border-left: 4px solid #a3e635;">
                    <p style="margin: 0 0 8px 0; color: #71717a; font-size: 11px; text-transform: uppercase; font-weight: 900; letter-spacing: 1px;">Net Kasa (Toplam Gelir)</p>
                    <p style="margin: 0; font-size: 32px; font-weight: 900; color: #a3e635; font-style: italic;">₺{{total_income}}</p>
                  </td>
                </tr>
              </table>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 40px;">
                <tr>
                  <td width="48%" style="background-color: #18181b; padding: 20px; border-radius: 16px; border: 1px solid #27272a;">
                    <p style="margin: 0 0 8px 0; color: #71717a; font-size: 10px; text-transform: uppercase; font-weight: bold;">Nakit Tahsilat</p>
                    <p style="margin: 0; font-size: 20px; font-weight: 900; color: #ffffff; font-style: italic;">₺{{cash_income}}</p>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="background-color: #18181b; padding: 20px; border-radius: 16px; border: 1px solid #27272a;">
                    <p style="margin: 0 0 8px 0; color: #71717a; font-size: 10px; text-transform: uppercase; font-weight: bold;">Kart Tahsilat</p>
                    <p style="margin: 0; font-size: 20px; font-weight: 900; color: #ffffff; font-style: italic;">₺{{card_income}}</p>
                  </td>
                </tr>
              </table>

              <h3 style="margin: 0 0 15px 0; font-size: 12px; color: #71717a; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid #27272a; padding-bottom: 10px;">Yeni Kayıtlar ({{new_member_count}})</h3>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 30px;">
                {{new_members_html}}
              </table>

              <h3 style="margin: 0 0 15px 0; font-size: 12px; color: #71717a; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid #27272a; padding-bottom: 10px;">Mağaza (POS) İşlemleri</h3>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 10px;">
                {{store_sales_html}}
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="background-color: #a3e635; padding: 25px;">
              <a href="https://liftrixcore.com" style="color: #000000; text-decoration: none; font-weight: 900; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; display: inline-block;">SİSTEME GİRİŞ YAP VE DETAYLARI GÖR</a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 25px;">
              <p style="margin: 0; color: #52525b; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">BU MESAJ LIFTRIX CORE OTONOM YAPAY ZEKASI TARAFINDAN OLUŞTURULMUŞTUR.<br>SERIOUS GYMS ONLY.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ==========================================
// 2. OTONOM BEYİN (API ROUTE)
// ==========================================
export async function GET(request: Request) {
  try {
    // A. GÜVENLİK KONTROLÜ
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    if (secret !== 'LIFTRIX_CRON_2026') {
      return NextResponse.json({ error: 'Yetkisiz erişim. Sadece Liftrix Otonom Sistemi tetikleyebilir.' }, { status: 401 });
    }

    // B. ÇEVRE DEĞİŞKENLERİ
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
       return NextResponse.json({ error: 'Supabase ayarları bulunamadı.' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    // RESEND İSTEMCİSİNİ BAŞLAT
    const resend = new Resend(resendApiKey);

    // C. ZAMAN HESAPLAMASI
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayISO = yesterdayDate.toISOString().split('T')[0]; 

    // D. TÜM ŞUBELERİ ÇEK
    const { data: gyms, error: gymError } = await supabase.from('gyms').select('*');
    if (gymError) throw gymError;

    const reportLogs = []; 

    // E. HER ŞUBE İÇİN DÖNGÜYE GİR
    for (const gym of gyms) {
      
      const { data: admins } = await supabase.from('profiles').select('email').eq('gym_id', gym.id).eq('role', 'admin');
      const adminEmail = admins && admins.length > 0 ? admins[0].email : null;
      
      if (!adminEmail) {
        reportLogs.push(`${gym.name} için admin bulunamadı, atlandı.`);
        continue;
      }

      // Finansal Veriler
      const { data: finances } = await supabase.from('finance_logs')
        .select('*')
        .eq('gym_id', gym.id)
        .gte('created_at', yesterdayISO);

      let totalIncome = 0;
      let cashIncome = 0;
      let cardIncome = 0;
      let storeSalesHtml = '';

      if (finances) {
        finances.forEach(tx => {
          if (tx.type === 'GELİR') {
            totalIncome += Number(tx.amount);
            if (tx.method === 'NAKİT') cashIncome += Number(tx.amount);
            if (tx.method === 'KART') cardIncome += Number(tx.amount);
            
            if (tx.description.includes('Mağaza')) {
                storeSalesHtml += `
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px dashed #27272a; color: #e4e4e7; font-size: 13px;">${tx.description.replace('Mağaza: ', '')}</td>
                  <td style="padding: 12px 0; border-bottom: 1px dashed #27272a; color: #a3e635; text-align: right; font-size: 13px; font-weight: bold; font-style: italic;">₺${tx.amount}</td>
                </tr>`;
            }
          }
        });
      }

      if (storeSalesHtml === '') {
          storeSalesHtml = `<tr><td style="padding: 12px 0; color: #52525b; font-size: 12px; font-style: italic;">Son 24 saatte mağaza satışı bulunmuyor.</td></tr>`;
      }

      // Yeni Üyeler
      const { data: newMembers } = await supabase.from('members')
        .select('*')
        .eq('gym_id', gym.id)
        .gte('created_at', yesterdayISO);

      let newMembersHtml = '';
      
      if (newMembers && newMembers.length > 0) {
          newMembers.forEach(m => {
             newMembersHtml += `
             <tr>
               <td style="padding: 12px 0; border-bottom: 1px dashed #27272a; color: #e4e4e7; font-weight: bold; text-transform: uppercase; font-size: 13px;">${m.full_name}</td>
               <td style="padding: 12px 0; border-bottom: 1px dashed #27272a; color: #a3e635; text-align: right; font-size: 11px; font-weight: 900; font-style: italic;">YENİ ÜYE BİTİŞ: ${m.membership_end}</td>
             </tr>`;
          });
      } else {
          newMembersHtml = `<tr><td style="padding: 12px 0; color: #52525b; font-size: 12px; font-style: italic;">Son 24 saatte yeni üye kaydı bulunmuyor.</td></tr>`;
      }

      // Şablonu Gerçek Verilerle Doldur
      const finalHtml = emailTemplate
        .replace('{{gym_name}}', gym.name)
        .replace('{{total_income}}', totalIncome.toLocaleString('tr-TR'))
        .replace('{{cash_income}}', cashIncome.toLocaleString('tr-TR'))
        .replace('{{card_income}}', cardIncome.toLocaleString('tr-TR'))
        .replace('{{new_member_count}}', newMembers ? newMembers.length.toString() : '0')
        .replace('{{new_members_html}}', newMembersHtml)
        .replace('{{store_sales_html}}', storeSalesHtml);

      // 5. MAİL GÖNDERME İŞLEMİ (RESEND RESMİ SDK İLE)
      if (resendApiKey) {
        const { data, error } = await resend.emails.send({
          from: 'LIFTRIX CORE <onboarding@resend.dev>',
          to: adminEmail,
          subject: `LIFTRIX: ${gym.name} Şubesi Günlük Raporu`,
          html: finalHtml
        });

        if (error) {
          reportLogs.push({ gym: gym.name, admin: adminEmail, status: 'Resend Gönderim Hatası', error: error.message });
        } else {
          reportLogs.push({ gym: gym.name, admin: adminEmail, status: 'E-Posta Başarıyla Gönderildi!', id: data?.id });
        }
      } else {
        reportLogs.push({ gym: gym.name, admin: adminEmail, status: 'API Key Eksik. Sadece HTML hazırlandı.', total_income: totalIncome });
      }
    }

    // F. İŞLEM SONUCUNU EKRANA YANSIT
    return NextResponse.json({ 
      success: true, 
      message: 'Günlük şube raporu döngüsü tamamlandı.',
      logs: reportLogs 
    }, { status: 200 });

  } catch (error) {
    return NextResponse.json({ error: 'Sunucu Hatası: ' + error.message }, { status: 500 });
  }
}