'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
// YENİ EKLENEN İÇE AKTARMA: Arka plan işlemleri için
import { createClient } from '@supabase/supabase-js';

// --- SIDEBAR YOĞUNLUK PANELİ ---
const SidebarDensityMap = ({ checkinData }: { checkinData: any }) => {
  const hourlyStats = Array(24).fill(0);
  checkinData.forEach((item: any) => {
    const hour = new Date(item.created_at).getHours();
    if (item.action === 'GİRİŞ') hourlyStats[hour]++;
  });
  const maxDensity = Math.max(...hourlyStats) || 1;

  return (
    <div className="mt-auto pt-6 border-t border-zinc-900 group-hover:block hidden animate-in fade-in duration-500">
      <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-3 italic text-center">
        Günlük Yoğunluk Haritası
      </p>
      <div className="flex items-end justify-between h-14 gap-0.5 px-2">
        {hourlyStats.slice(8, 22).map((count, i) => (
          <div
            key={i}
            className="flex-1 bg-lime-400 rounded-t-[1px]"
            style={{
              height: `${(count / maxDensity) * 60}%`,
              opacity: count > 0 ? 0.3 + (count / maxDensity) * 0.7 : 0.1,
            }}
          ></div>
        ))}
      </div>
    </div>
  );
};

export default function Dashboard() {
 const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // DİNAMİK PROFİL STATE'LERİ
  const [userProfile, setUserProfile] = useState(null);
  const [currentGymId, setCurrentGymId] = useState('');
  
  const [appMode, setAppMode] = useState('member');
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);

  // Veri State'leri
  const [checkins, setCheckins] = useState([]);
  const [inGymCount, setInGymCount] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);
  const [dailyCheckins, setDailyCheckins] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [members, setMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [classes, setClasses] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [showClassModal, setShowClassModal] = useState(false);
  const [newClass, setNewClass] = useState({ name: '', trainer: '', day: 'Pazartesi', time: '10:00', capacity: 10 });
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [newProduct, setNewProduct] = useState({ id: null, name: '', price: '', stock: '' });
  const [qrToken, setQrToken] = useState('');
  const [qrProgress, setQrProgress] = useState(100);
  const [doorStatus, setDoorStatus] = useState('KAPALI');
  const timerRef = useRef(null);
  const [transactions, setTransactions] = useState([]);
  const [showFinanceModal, setShowFinanceModal] = useState(false);
  const [newTx, setNewTx] = useState({ type: 'GELİR', amount: '', method: 'NAKİT', description: '' });

  // SUPER ADMIN STATE'LERİ (OTOMASYON İÇİN E-POSTA VE ŞİFRE EKLENDİ)
  const [allGyms, setAllGyms] = useState([]);
  const [newGym, setNewGym] = useState({ id: '', name: '', adminEmail: '', adminPassword: '' });

  const [membershipPrices, setMembershipPrices] = useState({ '1': 1000, '3': 2500, '6': 4500, '12': 8000 });
  const [newMember, setNewMember] = useState({ full_name: '', phone: '', gender: 'Erkek', membership_duration: '1', injury_notes: '', current_program: '' });

  // --- 1. SUPABASE AUTH & DİNAMİK PROFİL YÜKLEME ---
  useEffect(() => {
    const loadProfile = async (currentUser: any) => {
      if (!currentUser) return;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
      
      if (profile) {
        setUserProfile(profile);
        setCurrentGymId(profile.gym_id);
        if (profile.role === 'superadmin' || profile.role === 'admin' || profile.role === 'staff') {
          setAppMode('admin');
        } else {
          setAppMode('member');
        }

        // ŞUBEYE ÖZEL FİYATLARI ÇEKME
        const { data: plans } = await supabase.from('membership_plans').select('*').eq('gym_id', profile.gym_id);
        if (plans && plans.length > 0) {
          const pMap: any = {};
          plans.forEach(pl => pMap[pl.duration_months] = pl.price);
          setMembershipPrices(prev => ({ ...prev, ...pMap }));
        }

      } else {
        setAppMode('member');
      }
      setAuthLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session.user);
      else setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadProfile(session.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail.trim(), password: loginPassword });
    if (error) setAuthError(`HATA: ${error.message}`);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); };

  const generateNewQR = () => {
    const newToken = `LIFTRIX_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    setQrToken(newToken);
    setQrProgress(100);
  };

  useEffect(() => {
    if (session && (currentTab === 'turnstile' || appMode === 'member')) {
      generateNewQR();
      (timerRef as any).current = setInterval(() => {
        setQrProgress((prev) => {
          if (prev <= 0) { generateNewQR(); return 100; }
          return prev - 1;
        });
      }, 100);
    } else {
      clearInterval(timerRef.current as any);
    }
    return () => clearInterval(timerRef.current as any);
  }, [currentTab, appMode, session]);

  // --- DİNAMİK VERİ ÇEKME (CURRENT_GYM_ID'YE GÖRE) ---
  const fetchData = async () => {
    if (!session || !currentGymId) return; 

    const today = new Date().toISOString().split('T')[0];
    
    const { data: list } = await supabase.from('checkins').select('*').eq('gym_id', currentGymId).order('created_at', { ascending: false }).limit(6);
    setCheckins((list || []) as any);

    const { data: allDay } = await supabase.from('checkins').select('*').eq('gym_id', currentGymId).gte('created_at', today).order('created_at', { ascending: true });
    setDailyCheckins((allDay || []) as any);

    const latestStatusPerMember = {};
    allDay?.forEach((log) => { latestStatusPerMember[log.member_name] = log.action; });
    setInGymCount(Object.values(latestStatusPerMember).filter((status) => status === 'GİRİŞ').length);

    const { data: mList, count } = await supabase.from('members').select('*', { count: 'exact' }).eq('gym_id', currentGymId);
    setTotalMembers(count || 0);
    setMembers(mList || []);

    if (userProfile?.role === 'superadmin' || userProfile?.role === 'admin') {
      const { data: fList } = await supabase.from('finance_logs').select('*').eq('gym_id', currentGymId).order('created_at', { ascending: false });
      setTransactions(fList || []);
    }

    const { data: cList } = await supabase.from('classes').select('*').eq('gym_id', currentGymId).order('time', { ascending: true });
    setClasses(cList || []);
    const { data: bList } = await supabase.from('bookings').select('*').eq('gym_id', currentGymId);
    setBookings(bList || []);

    const { data: pList } = await supabase.from('products').select('*').eq('gym_id', currentGymId).order('name', { ascending: true });
    setProducts(pList || []);

    if (userProfile?.role === 'superadmin') {
      const { data: gymsData } = await supabase.from('gyms').select('*').order('created_at', { ascending: false });
      setAllGyms(gymsData || []);
    }
  };

  useEffect(() => {
    fetchData();
    if(session && currentGymId) {
      const channel = supabase.channel('realtime')
        .on('postgres_changes', { event: '*', schema: 'public' }, () => fetchData())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [currentTab, session, currentGymId, userProfile]);

  // --- KURUCU: YENİ SALON EKLEME VE OTOMATİK PATRON KAYDI ---
  const handleAddNewGym = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // 1. Şubeyi GYMS tablosuna ekle
      const { error: gymError } = await supabase.from('gyms').insert([{
        id: newGym.id.toUpperCase(),
        name: newGym.name
      }]);
      
      if (gymError) throw new Error("Şube oluşturulamadı: " + gymError.message);

      // 2. Yeni Patronu arka planda Auth sistemine kaydet
      // (Kendi oturumumuzu bozmamak için 'persistSession: false' ile gizli bir bağlantı açıyoruz)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env?.VITE_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY;
      
      const tempClient = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false }
      });

      const { data: authData, error: authError } = await tempClient.auth.signUp({
        email: newGym.adminEmail,
        password: newGym.adminPassword,
      });

      if (authError) throw new Error("Patron hesabı açılamadı: " + authError.message);

      // 3. Patronu PROFILES tablosunda doğrudan 'admin' olarak şubeyle eşleştir
      if (authData?.user) {
        const { error: profileError } = await supabase.from('profiles').insert([{
          id: authData.user.id,
          email: newGym.adminEmail,
          gym_id: newGym.id.toUpperCase(),
          role: 'admin'
        }]);
        
        if(profileError) throw new Error("Profil eşleştirme hatası: " + profileError.message);
      }

      alert(`✅ ${newGym.name} başarıyla kuruldu!\n\nPatronunuz artık ${newGym.adminEmail} e-postası ve belirlediğiniz şifre ile giriş yapıp hemen kullanmaya başlayabilir.`);
      setNewGym({ id: '', name: '', adminEmail: '', adminPassword: '' });
      fetchData();
      
    } catch (err) {
      alert("HATA: " + err.message);
    }
    
    setLoading(false);
  };

  // --- ŞUBE AYARLARI GÜNCELLEME ---
  const handleUpdatePrices = async (e) => {
    e.preventDefault();
    setLoading(true);
    for (const [months, price] of Object.entries(membershipPrices)) {
      const { data: existing } = await supabase.from('membership_plans').select('id').eq('gym_id', currentGymId).eq('duration_months', months).single();
      if (existing) {
        await supabase.from('membership_plans').update({ price: Number(price) }).eq('id', existing.id);
      } else {
        await supabase.from('membership_plans').insert([{ gym_id: currentGymId, duration_months: months, price: Number(price) }]);
      }
    }
    alert("Şube fiyatları başarıyla güncellendi!");
    setLoading(false);
  };

  // --- MAĞAZA VE DİĞER İŞLEMLER ---
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (newProduct.id) {
      await supabase.from('products').update({ name: newProduct.name, price: Number(newProduct.price), stock: Number(newProduct.stock) }).eq('id', newProduct.id);
    } else {
      const { error } = await supabase.from('products').insert([{ name: newProduct.name, price: Number(newProduct.price), stock: Number(newProduct.stock), gym_id: currentGymId }]);
      if (error) alert("Ürün eklenirken hata oluştu: " + error.message);
    }
    setShowProductModal(false);
    fetchData();
    setLoading(false);
  };

  const handleDeleteProduct = async () => {
    if(!window.confirm('Emin misiniz?')) return;
    setLoading(true);
    await supabase.from('products').delete().eq('id', newProduct.id);
    setShowProductModal(false); fetchData();
    setLoading(false);
  };

  const openEditProductModal = (e, product) => {
    e.stopPropagation();
    setNewProduct({ id: product.id, name: product.name, price: product.price, stock: product.stock });
    setShowProductModal(true);
  };

  const addToCart = (product) => {
    if (product.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId) => setCart(prev => prev.filter(item => item.id !== productId));
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleCheckout = async (method) => {
    if (cart.length === 0) return;
    setLoading(true);
    const itemNames = cart.map(item => `${item.quantity}x ${item.name}`).join(', ');
    for (let item of cart) {
      await supabase.from('products').update({ stock: item.stock - item.quantity }).eq('id', item.id);
    }
    await supabase.from('finance_logs').insert([{ type: 'GELİR', amount: cartTotal, method: method, description: `Mağaza: ${itemNames}`, gym_id: currentGymId }]);
    setCart([]); fetchData(); setLoading(false);
  };

  const getAtRiskMembers = () => {
    const today = new Date(); const nextWeek = new Date(); nextWeek.setDate(today.getDate() + 7);
    return members.filter((m) => {
      if (!m.membership_end) return false;
      const end = new Date(m.membership_end); return end >= today && end <= nextWeek;
    });
  };

  const handleUpdateMember = async () => {
    setLoading(true);
    await supabase.from('members').update({
        full_name: selectedMember.full_name, phone: selectedMember.phone,
        injury_notes: selectedMember.injury_notes, current_program: selectedMember.current_program,
        membership_end: selectedMember.membership_end,
      }).eq('id', selectedMember.id);
    setIsEditing(false); fetchData(); setLoading(false);
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    setLoading(true);
    await supabase.from('finance_logs').insert([{ ...newTx, amount: Number(newTx.amount), gym_id: currentGymId }]);
    setShowFinanceModal(false); setNewTx({ type: 'GELİR', amount: '', method: 'NAKİT', description: '' }); fetchData(); setLoading(false);
  };

  const handleAddClass = async (e) => {
    e.preventDefault(); setLoading(true);
    await supabase.from('classes').insert([{ ...newClass, gym_id: currentGymId }]);
    setShowClassModal(false); fetchData(); setLoading(false);
  };

  const handleBooking = async (classId, member) => {
    if (!member) { alert("Üye seçin!"); return; }
    const classInfo = classes.find(c => c.id === classId);
    const classBookings = bookings.filter(b => b.class_id === classId);
    if (classBookings.length >= classInfo.capacity) { alert("Dolu!"); return; }
    if (classBookings.some(b => b.member_id === member.id)) { alert("Zaten kayıtlı!"); return; }
    await supabase.from('bookings').insert([{ class_id: classId, member_id: member.id, member_name: member.full_name, gym_id: currentGymId }]);
    fetchData();
  };

  const cancelBooking = async (bookingId) => { await supabase.from('bookings').delete().eq('id', bookingId); fetchData(); };

  const sendWhatsApp = (member) => {
    const msg = `Merhaba ${member.full_name}, LIFTRIX üyeliğin dolmak üzere. Seni bekliyoruz!`;
    const phone = member.phone?.replace(/\D/g, '');
    if(phone) window.open(`https://wa.me/${phone.startsWith('90') ? phone : '90' + phone}?text=${encodeURIComponent(msg)}`, '_blank');
    else alert("Numara yok.");
  };

  const handleAction = async (type, name) => {
    await supabase.from('checkins').insert([{ member_name: name, action: type, gym_id: currentGymId }]); fetchData();
  };

  // --- GÜNCEL: ÜYE KAYDI VE OTOMATİK FİNANS İŞLEMİ ---
  const handleAddMember = async (e) => {
    e.preventDefault(); setLoading(true);
    const duration = newMember.membership_duration;
    const fee = membershipPrices[duration];
    const endDate = new Date(); endDate.setMonth(endDate.getMonth() + parseInt(duration));
    
    // 1. Üyeyi Kaydet
    const { error: mError } = await supabase.from('members').insert([{
        full_name: newMember.full_name, phone: newMember.phone, gender: newMember.gender,
        membership_end: endDate.toISOString().split('T')[0], monthly_fee: Math.round(fee / parseInt(duration)),
        injury_notes: newMember.injury_notes, current_program: newMember.current_program, gym_id: currentGymId
      }]);

    if (!mError) {
      // 2. Finans Loguna Otomatik Kayıt At
      await supabase.from('finance_logs').insert([{ 
        type: 'GELİR', amount: fee, method: 'NAKİT', 
        description: `Yeni Üye Kaydı: ${newMember.full_name} (${duration} Ay)`, gym_id: currentGymId 
      }]);

      setShowAddModal(false); 
      setNewMember({ full_name: '', phone: '', gender: 'Erkek', membership_duration: '1', injury_notes: '', current_program: '' }); 
      fetchData();
      alert("Üye başarıyla kaydedildi ve ödemesi otomatik olarak kasaya işlendi!");
    } else {
      alert("Kayıt sırasında hata oluştu: " + mError.message);
    }
    setLoading(false);
  };

  const filteredMembers = members.filter((m) => m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const mrr = members.reduce((sum, m) => sum + (Number(m.monthly_fee) || 0), 0);
  const totalIncome = transactions.filter(t => t.type === 'GELİR').reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type === 'GİDER').reduce((sum, t) => sum + Number(t.amount), 0);
  const netBalance = totalIncome - totalExpense;
  const cashBalance = transactions.filter(t => t.method === 'NAKİT').reduce((sum, t) => sum + (t.type === 'GELİR' ? Number(t.amount) : -Number(t.amount)), 0);
  const cardBalance = transactions.filter(t => t.method === 'KART').reduce((sum, t) => sum + (t.type === 'GELİR' ? Number(t.amount) : -Number(t.amount)), 0);

  // ==========================================
  // UI RENDER KISMI
  // ==========================================
  if (authLoading) return <div className="h-screen bg-black flex items-center justify-center"><div className="w-12 h-12 border-4 border-zinc-800 border-t-lime-400 rounded-full animate-spin"></div></div>;
  
  // GİRİŞ EKRANI
  if (!session) {
    return (
      <div className="h-screen bg-black flex items-center justify-center relative overflow-hidden font-sans">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900/40 via-black to-black opacity-80 pointer-events-none"></div>
        <div className="z-10 bg-zinc-950 border border-zinc-900 p-12 rounded-[3rem] w-full max-w-md shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-500">
          <div className="mb-2">
            <h1 className="text-6xl font-black italic tracking-tighter uppercase leading-[0.8] text-white">LIFTRI<span className="text-yellow-400">X</span></h1>
          </div>
          <p className="text-zinc-500 font-bold tracking-[0.3em] uppercase mb-10 text-[10px]">Merkezi Yönetim Sistemi</p>
          
          <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
            {authError && <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl text-[10px] font-black uppercase text-center mb-2">{authError}</div>}
            <input type="email" placeholder="E-POSTA" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-400 rounded-2xl p-4 text-sm font-bold text-white outline-none transition-all placeholder:text-zinc-600" />
            <input type="password" placeholder="ŞİFRE" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 focus:border-lime-400 rounded-2xl p-4 text-sm font-bold text-white outline-none transition-all placeholder:text-zinc-600 tracking-widest" />
            <button type="submit" disabled={authLoading} className="w-full mt-4 bg-lime-400 hover:bg-lime-300 text-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(163,230,53,0.2)] hover:shadow-[0_0_30px_rgba(163,230,53,0.4)] active:scale-95 transition-all">SİSTEME GİRİŞ YAP</button>
          </form>
          <p className="mt-8 text-[9px] text-zinc-700 font-black uppercase tracking-widest">Serious Gyms Only.</p>
        </div>
      </div>
    );
  }

  // MOBİL ÜYE EKRANI
  if (appMode === 'member') {
    const activeMember = members.find(m => m.full_name?.toLowerCase().includes(session.user.email.split('@')[0])) || members[0] || {
      full_name: session.user.email.split('@')[0].toUpperCase(),
      membership_end: 'Lütfen antrenörünüzden LIFTRIX aktivasyonu isteyin.',
      current_program: 'Hoş geldiniz. Programınız henüz yüklenmemiştir.',
    };

    return (
      <div className="h-screen bg-black text-white font-sans flex flex-col items-center overflow-hidden">
        <div className="w-full h-full max-w-md bg-zinc-950 shadow-2xl relative flex flex-col overflow-y-auto custom-scrollbar border-x border-zinc-900">
          <header className="flex justify-between items-center p-6 border-b border-zinc-900 shrink-0 sticky top-0 bg-zinc-950/90 backdrop-blur-md z-10">
            <div>
              <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-[0.8] text-white">LIFTRI<span className="text-yellow-400">X</span></h1>
              <p className="text-zinc-500 font-bold tracking-widest uppercase mt-2 text-[9px]">Üye: {activeMember.full_name}</p>
            </div>
            <button onClick={handleLogout} className="bg-red-500/10 text-red-500 border border-red-500/20 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-red-500 hover:text-white transition-all">ÇIKIŞ YAP</button>
          </header>
          <main className="flex-1 p-6 flex flex-col gap-8 pb-20">
            <section className="flex flex-col items-center">
              <p className="text-zinc-600 font-black tracking-widest uppercase mb-4 text-[10px] w-full text-center">Giriş QR Kodu</p>
              <div className="bg-white p-4 rounded-3xl shadow-[0_0_30px_rgba(163,230,53,0.1)] relative overflow-hidden">
                <div className="absolute top-0 left-0 h-1 bg-lime-400 transition-all duration-100 ease-linear" style={{ width: `${qrProgress}%` }}></div>
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrToken}`} alt="QR" className="w-48 h-48" />
              </div>
            </section>
            <section>
              <div className="flex justify-between items-end mb-4"><h2 className="text-lg font-black italic text-lime-400 uppercase tracking-tighter">Günün Programı</h2><span className="text-[9px] bg-lime-400/10 text-lime-400 px-2 py-1 rounded-md font-black uppercase border border-lime-400/20">AKTİF</span></div>
              <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-[2rem] shadow-lg relative overflow-hidden group"><div className="absolute left-0 top-0 w-1 h-full bg-yellow-400"></div><div className="pl-2"><p className="text-sm font-bold text-zinc-300 whitespace-pre-wrap uppercase tracking-tighter leading-relaxed">{activeMember.current_program}</p></div></div>
            </section>
            <section className="mt-auto"><div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-[2rem] flex justify-between items-center"><div><p className="text-zinc-600 font-black tracking-widest uppercase mb-1 text-[9px]">Üyelik Bitiş</p><p className="text-lg font-mono text-white font-bold">{activeMember.membership_end}</p></div></div></section>
          </main>
        </div>
      </div>
    );
  }

  // YÖNETİCİ EKRANI (ADMIN / SUPERADMIN)
  if (currentTab === 'turnstile') {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center relative overflow-y-auto text-center p-6">
        <button onClick={() => setCurrentTab('dashboard')} className="absolute top-8 right-8 text-zinc-600 hover:text-white uppercase font-black text-[10px] tracking-widest border border-zinc-800 px-4 py-2 rounded-xl transition-all z-20">GERİ DÖN</button>
        <div className={`fixed inset-0 z-0 transition-opacity duration-500 pointer-events-none ${doorStatus !== 'KAPALI' ? 'bg-lime-400/20 opacity-100' : 'opacity-0'}`}></div>
        <div className="z-10 flex flex-col items-center justify-center w-full max-w-md my-auto">
          <div className="mb-8 flex items-center justify-center w-full"><h1 className="text-7xl md:text-[7rem] font-black italic text-white tracking-tighter drop-shadow-2xl">LIFTRI<span className="text-yellow-400">X</span></h1></div>
          <p className="text-zinc-500 font-bold tracking-[0.3em] uppercase mb-8 text-[11px]">Giriş İçin Mobil Uygulamayı Okutun</p>
          <div className="relative inline-block bg-white p-5 rounded-[2rem] shadow-[0_0_50px_rgba(255,255,255,0.1)] overflow-hidden shrink-0">
            <div className="absolute top-0 left-0 h-1 bg-lime-400 transition-all duration-100 ease-linear" style={{ width: `${qrProgress}%` }}></div>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${qrToken}`} alt="QR" className="w-56 h-56 md:w-64 md:h-64" />
          </div>
          <div className="mt-8 h-12 flex items-center justify-center">
            {doorStatus !== 'KAPALI' ? <p className="text-2xl font-black text-lime-400 uppercase italic tracking-tighter animate-in zoom-in duration-300">✓ {doorStatus}</p> : <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest animate-pulse">QR Kod Otomatik Yenileniyor...</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black text-white font-sans flex overflow-hidden text-left">
      <aside className="group w-16 hover:w-64 border-r border-zinc-900 flex flex-col transition-all duration-500 bg-zinc-950 z-50 relative shadow-2xl">
        <div className="group-hover:hidden absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="bg-lime-400 p-1.5 rounded-lg mb-6 text-black animate-bounce"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="m9 18 6-6-6-6" /></svg></div>
          <div className="bg-white px-2 py-4 rounded-md flex items-center justify-center">
            <p className="rotate-180 font-black uppercase text-black text-[10px] tracking-[0.3em] leading-none whitespace-nowrap" style={{ writingMode: 'vertical-rl' }}>YÖNETİM PANELİ</p>
          </div>
        </div>
        {/* KAYDIRMA (SCROLL) DÜZELTMESİ BURADA */}
        <div className="hidden group-hover:flex flex-col h-full p-8 animate-in slide-in-from-left duration-300 overflow-y-auto custom-scrollbar">
          <div className="mb-10 text-white font-black italic text-2xl tracking-tighter uppercase leading-none shrink-0">
            LIFTRI<span className="text-yellow-400">X</span>
            <p className="text-[10px] text-zinc-500 mt-1 not-italic tracking-widest uppercase font-black text-left">CORE v4.3</p>
          </div>
          <nav className="space-y-2 flex-1">
            <button onClick={() => setCurrentTab('dashboard')} className={`w-full text-left px-5 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${currentTab === 'dashboard' ? 'bg-lime-400 text-black scale-95' : 'text-zinc-500 hover:bg-zinc-900'}`}>ANA PANEL</button>
            <button onClick={() => setCurrentTab('members')} className={`w-full text-left px-5 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${currentTab === 'members' ? 'bg-lime-400 text-black scale-95' : 'text-zinc-500 hover:bg-zinc-900'}`}>ÜYE YÖNETİMİ</button>
            <button onClick={() => setCurrentTab('scheduling')} className={`w-full text-left px-5 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${currentTab === 'scheduling' ? 'bg-lime-400 text-black scale-95' : 'text-zinc-500 hover:bg-zinc-900'}`}>DERS PROGRAMI</button>
            <button onClick={() => setCurrentTab('store')} className={`w-full text-left px-5 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${currentTab === 'store' ? 'bg-lime-400 text-black scale-95' : 'text-zinc-500 hover:bg-zinc-900'}`}>MAĞAZA (POS)</button>
            
            {(userProfile?.role === 'superadmin' || userProfile?.role === 'admin') && (
              <>
                <button onClick={() => setCurrentTab('reports')} className={`w-full text-left px-5 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${currentTab === 'reports' ? 'bg-lime-400 text-black scale-95' : 'text-zinc-500 hover:bg-zinc-900'}`}>FİNANS & RAPOR</button>
                {/* AYARLAR SEKMESİ */}
                <button onClick={() => setCurrentTab('settings')} className={`w-full text-left px-5 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${currentTab === 'settings' ? 'bg-zinc-800 text-lime-400 scale-95' : 'text-zinc-500 hover:bg-zinc-900'}`}>⚙️ ŞUBE AYARLARI</button>
              </>
            )}

            <div className="pt-4 border-t border-zinc-800 mt-4"><button onClick={() => setCurrentTab('turnstile')} className="w-full bg-white text-black text-left px-5 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg hover:scale-95 italic">TURNİKE MODU</button></div>
            
            {/* SUPER ADMIN (KURUCU) SEKMESİ */}
            {userProfile?.role === 'superadmin' && (
              <div className="pt-4 mt-4"><button onClick={() => setCurrentTab('superadmin')} className={`w-full text-left px-5 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg ${currentTab === 'superadmin' ? 'bg-red-500 text-white scale-95' : 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white'}`}>SUPER ADMIN</button></div>
            )}
          </nav>
          
          <div className="mt-auto pt-6 shrink-0 group-hover:block hidden">
             <div className="text-[9px] text-zinc-500 mb-1 font-black uppercase tracking-widest text-center">{session.user.email}</div>
             <div className="text-[9px] text-lime-400/70 mb-3 font-black uppercase tracking-widest text-center border border-lime-400/20 rounded-md py-1">{userProfile?.role}</div>
             <button onClick={handleLogout} className="w-full bg-red-500/10 text-red-500 border border-red-500/20 px-5 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:bg-red-500 hover:text-white">ÇIKIŞ YAP</button>
          </div>
        </div>
      </aside>

      <main className="flex-1 px-8 md:px-12 py-6 flex flex-col h-full overflow-hidden text-left">
        <div className="max-w-6xl mx-auto w-full h-full flex flex-col">
          <header className="flex justify-between items-center mb-8 shrink-0">
            <div>
              <h2 className="text-6xl font-black italic tracking-tighter uppercase leading-[0.8] text-white">LIFTRI<span className="text-yellow-400">X</span> <span className="text-lime-400 ml-4">CORE</span></h2>
              <p className="text-zinc-500 font-bold tracking-[0.3em] uppercase mt-4 text-[11px]">{currentGymId || 'ŞUBE BİLGİSİ YÜKLENİYOR...'}</p>
            </div>
            <div className="flex gap-10 items-center">
              <div className="text-right border-l border-zinc-900 pl-8"><p className="text-5xl font-black italic text-white leading-none tracking-tighter">{totalMembers}</p><p className="text-[9px] text-zinc-600 uppercase font-black mt-3 tracking-widest">Toplam Üye</p></div>
              <div className="text-right border-l border-zinc-900 pl-10"><p className="text-5xl font-black italic text-lime-400 leading-none tracking-tighter">{inGymCount}</p><p className="text-[9px] text-zinc-600 uppercase font-black mt-3 tracking-[0.2em]">Salonda</p></div>
            </div>
          </header>

          {/* DİĞER SEKMELER */}
          {currentTab === 'dashboard' && (
            <div className="flex flex-col flex-1 overflow-hidden animate-in fade-in duration-500">
               <div className="relative mb-6">
                <button onClick={() => setAiExpanded(!aiExpanded)} className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-[10px] uppercase transition-all shadow-lg ${aiExpanded ? 'bg-white text-black' : 'bg-lime-400 text-black animate-pulse'}`}><span className="bg-black text-lime-400 px-2 py-0.5 rounded italic font-black">AI</span> {aiExpanded ? 'TAVSİYEYİ KAPAT' : 'AI TAVSİYESİ AL'}</button>
                {aiExpanded && (
                  <div className="absolute top-full left-0 w-full mt-3 bg-zinc-900 border border-zinc-800 p-6 rounded-3xl z-10 shadow-2xl animate-in slide-in-from-top-2 text-left">
                    <p className="text-xs font-black uppercase italic tracking-tighter text-lime-400 leading-relaxed">Profil (Role-Based) sistemi devrede. Veriler dinamik olarak {currentGymId} şubesine göre çekiliyor.</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-8 flex-1 overflow-hidden">
                <section className="col-span-2 bg-zinc-900/30 border border-zinc-900 rounded-[3rem] p-10 overflow-hidden flex flex-col">
                  <div className="flex justify-between items-center mb-8 border-b border-zinc-800/50 pb-4"><h4 className="text-xs font-black uppercase tracking-[0.4em] text-zinc-500 italic">Anlık Akış Logları</h4><span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_red]"></span></div>
                  <div className="grid grid-cols-1 gap-4 overflow-y-auto pr-2 custom-scrollbar">
                    {checkins.map((item) => (
                      <div key={item.id} className="bg-zinc-950/80 border border-zinc-800 p-3 rounded-[1.5rem] flex justify-between items-center group transition-all hover:border-lime-400">
                        <div className="flex items-center gap-5"><div className={`w-3 h-3 rounded-full ${item.action === 'GİRİŞ' ? 'bg-lime-400 shadow-[0_0_8px_#a3e635]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`}></div><div><p className="font-black text-sm uppercase italic text-white tracking-tighter group-hover:text-lime-400 transition-colors">{item.member_name}</p><p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">{item.action} YAPTI</p></div></div>
                        <div className="text-right font-mono text-[10px] text-zinc-500 italic">{new Date(item.created_at).toLocaleTimeString('tr-TR')}</div>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="col-span-1 bg-red-500/5 border border-red-500/20 rounded-[3rem] p-8 flex flex-col overflow-hidden text-left">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500 italic mb-6">Riskli Üyeler (7 Gün)</h4>
                  <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
                    {getAtRiskMembers().map((m) => (
                      <div key={m.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col gap-3">
                        <div className="flex justify-between items-start"><p className="font-black text-xs uppercase italic text-white leading-none">{m.full_name}</p><p className="font-mono text-[10px] text-orange-400">{m.membership_end.split('-').reverse().join('.')}</p></div>
                        <button onClick={() => sendWhatsApp(m)} className="w-full bg-green-600 hover:bg-green-500 text-white py-2 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 italic">HATIRLATMA GÖNDER</button>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          )}

          {currentTab === 'members' && (
             <div className="flex-1 grid grid-cols-3 gap-8 overflow-hidden animate-in fade-in duration-500">
              <div className="col-span-1 space-y-4 flex flex-col h-full text-left">
                <button onClick={() => setShowAddModal(true)} className="w-full bg-lime-400 text-black py-4 rounded-2xl font-black uppercase italic text-sm transition-all shadow-lg">+ YENİ ÜYE KAYDI</button>
                <input type="text" placeholder="ÜYE ARA..." className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 text-sm font-bold outline-none uppercase" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                <div className="flex-1 bg-zinc-900/20 border border-zinc-800 rounded-3xl overflow-y-auto custom-scrollbar">
                  {filteredMembers.map((m) => (
                    <button key={m.id} onClick={() => { setSelectedMember(m); setIsEditing(false); }} className={`w-full text-left px-6 py-4 border-b border-zinc-900 last:border-0 transition-all ${selectedMember?.id === m.id ? 'bg-zinc-800 text-lime-400' : 'hover:bg-zinc-900 text-zinc-400'}`}><p className="font-black text-xs uppercase italic tracking-widest">{m.full_name}</p></button>
                  ))}
                </div>
              </div>
              <div className="col-span-2">
                {selectedMember ? (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-10 h-full flex flex-col justify-between overflow-y-auto relative shadow-2xl text-left">
                    <div className="absolute top-8 right-8 flex flex-col gap-2 w-28 items-end">
                      <button onClick={() => setIsEditing(!isEditing)} className="w-full bg-zinc-800 text-zinc-400 p-2 rounded-xl hover:text-lime-400 border border-zinc-700 font-black text-[10px] italic transition-all">{isEditing ? 'İPTAL' : 'DÜZENLE'}</button>
                      {!isEditing && <button onClick={() => sendWhatsApp(selectedMember)} className="w-full bg-green-600/10 text-green-500 p-2 rounded-xl hover:bg-green-600 hover:text-white transition-all border border-green-500/20 font-black text-[10px] italic">WHATSAPP</button>}
                    </div>
                    <div>
                      <div className="flex justify-between items-start mb-8 pr-40">
                        <div className="text-left">
                          {isEditing ? (
                            <input className="bg-zinc-800 text-white text-4xl font-black italic uppercase outline-none border-b border-lime-400 w-full" value={selectedMember.full_name} onChange={(e) => setSelectedMember({ ...selectedMember, full_name: e.target.value })} />
                          ) : (
                            <h3 className="text-4xl font-black italic uppercase text-white tracking-tighter leading-none">{selectedMember.full_name}</h3>
                          )}
                          <div className="flex gap-2 mt-4">
                            <span className="text-[10px] bg-lime-400 text-black px-3 py-1 rounded-full font-black uppercase italic tracking-widest">AKTİF ÜYE</span>
                            {isEditing ? (
                              <input className="bg-zinc-800 text-zinc-400 text-[10px] font-black italic uppercase outline-none border-b border-lime-400 px-2" value={selectedMember.phone || ''} onChange={(e) => setSelectedMember({ ...selectedMember, phone: e.target.value })} placeholder="Telefon No" />
                            ) : (
                              <span className="text-[10px] bg-zinc-800 text-zinc-500 px-3 py-1 rounded-full font-black uppercase italic tracking-widest">{selectedMember.phone || 'Tel Yok'}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right leading-none">
                          <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest mb-1 italic">BİTİŞ TARİHİ</p>
                          <p className="text-xl font-mono text-orange-400 leading-none">{selectedMember.membership_end}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-8 text-left">
                        <div className="space-y-6">
                          <div>
                            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-2 italic">SAĞLIK NOTU</p>
                            {isEditing ? (
                              <textarea className="bg-zinc-800 text-red-400 text-xs p-4 rounded-2xl border border-lime-400 w-full outline-none h-24" value={selectedMember.injury_notes || ''} onChange={(e) => setSelectedMember({ ...selectedMember, injury_notes: e.target.value })} />
                            ) : (
                              <p className="text-xs bg-red-500/10 text-red-400 p-4 rounded-2xl border border-red-500/20">{selectedMember.injury_notes || 'KAYIT YOK'}</p>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-2 italic">PROGRAM</p>
                          {isEditing ? (
                            <textarea className="bg-zinc-800 text-zinc-300 text-xs p-4 rounded-2xl border border-lime-400 w-full outline-none h-40 uppercase" value={selectedMember.current_program || ''} onChange={(e) => setSelectedMember({ ...selectedMember, current_program: e.target.value })} />
                          ) : (
                            <p className="text-xs bg-zinc-800 p-4 rounded-2xl border border-zinc-700 italic text-zinc-300 h-40 overflow-y-auto uppercase tracking-tighter">{selectedMember.current_program || 'PROGRAM ATANMADI'}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-4 mt-8">
                      {isEditing ? (
                        <button onClick={handleUpdateMember} className="flex-1 bg-lime-400 text-black py-4 rounded-2xl font-black uppercase italic text-xs shadow-lg transition-all">KAYDET</button>
                      ) : (
                        <>
                          <button onClick={() => handleAction('GİRİŞ', selectedMember.full_name)} className="flex-1 bg-lime-400 text-black py-4 rounded-2xl font-black uppercase italic text-xs hover:scale-105 active:scale-95 transition-all">GİRİŞİ KAYDET</button>
                          <button onClick={() => handleAction('ÇIKIŞ', selectedMember.full_name)} className="flex-1 bg-zinc-800 text-white py-4 rounded-2xl font-black uppercase italic text-xs border border-zinc-700 hover:bg-zinc-700 active:scale-95 transition-all">ÇIKIŞI KAYDET</button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-full border-2 border-dashed border-zinc-900 rounded-[3rem] flex items-center justify-center text-zinc-700 font-black uppercase italic tracking-widest">Üye Seçiniz</div>
                )}
              </div>
            </div>
          )}

          {currentTab === 'scheduling' && (
            <div className="flex-1 flex gap-8 overflow-hidden animate-in fade-in duration-500">
              <div className="flex-1 bg-zinc-900/30 border border-zinc-900 rounded-[3rem] p-8 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">Haftalık Ders Takvimi</h3>
                  <button onClick={() => setShowClassModal(true)} className="bg-lime-400 text-black px-6 py-2 rounded-xl font-black text-[10px] shadow-lg">+ YENİ DERS</button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                  {['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'].map(day => (
                    <div key={day} className="space-y-3">
                      <h4 className="text-[10px] text-zinc-600 font-black uppercase tracking-widest sticky top-0 bg-black/80 backdrop-blur-md py-2 z-10">{day}</h4>
                      {classes.filter(c => c.day === day).map(c => {
                        const classBookings = bookings.filter(b => b.class_id === c.id);
                        return (
                          <div key={c.id} className="bg-zinc-950 border border-zinc-800 p-6 rounded-3xl flex justify-between items-center group hover:border-lime-400/50 transition-all">
                            <div>
                              <p className="text-[10px] text-lime-400 font-black mb-1">{c.time} — {c.trainer}</p>
                              <p className="text-xl font-black italic text-white tracking-tighter">{c.name}</p>
                              <div className="flex flex-wrap gap-2 mt-3">
                                {classBookings.map(b => (
                                  <span key={b.id} onClick={() => cancelBooking(b.id)} className="text-[9px] bg-zinc-800 text-zinc-400 px-2 py-1 rounded-md border border-zinc-700 cursor-pointer hover:bg-red-500 hover:text-white transition-all uppercase font-bold">{b.member_name} ✕</span>
                                ))}
                                {classBookings.length === 0 && <span className="text-[9px] text-zinc-600 italic">Henüz katılım yok</span>}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-black italic text-zinc-500 leading-none">{classBookings.length}<span className="text-xs text-zinc-700">/{c.capacity}</span></p>
                              <button onClick={() => handleBooking(c.id, selectedMember)} className="mt-3 bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-lime-400 px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all shadow-lg">KAYDET</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-80 flex flex-col gap-4">
                <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2rem]">
                  <p className="text-[10px] text-zinc-500 font-black uppercase mb-4 italic text-center">Seçili Üye (Kayıt İçin)</p>
                  {selectedMember ? (
                    <div className="text-center animate-in zoom-in">
                      <p className="text-xl font-black italic text-lime-400 uppercase leading-tight">{selectedMember.full_name}</p>
                      <button onClick={() => setSelectedMember(null)} className="text-[9px] text-zinc-600 mt-2 hover:text-white uppercase font-bold underline">TEMİZLE</button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-zinc-700 text-center italic">Üye listesinden birini seçin...</p>
                  )}
                </div>
                <div className="flex-1 bg-zinc-900/30 border border-zinc-900 rounded-[2rem] p-6 overflow-hidden flex flex-col">
                  <input type="text" placeholder="ÜYE ARA..." className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-[10px] font-bold outline-none mb-4 uppercase" onChange={e => setSearchQuery(e.target.value)} />
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {filteredMembers.map(m => (
                      <button key={m.id} onClick={() => setSelectedMember(m)} className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${selectedMember?.id === m.id ? 'bg-lime-400 border-lime-400 text-black' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}>
                        <p className="text-[10px] font-black uppercase italic tracking-widest">{m.full_name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentTab === 'store' && (
            <div className="flex-1 flex gap-8 overflow-hidden animate-in fade-in duration-500">
              <div className="flex-[2] bg-zinc-900/30 border border-zinc-900 rounded-[3rem] p-8 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">Satış Ekranı</h3>
                  <button onClick={() => { setNewProduct({ id: null, name: '', price: '', stock: '' }); setShowProductModal(true); }} className="bg-zinc-800 text-zinc-400 px-6 py-2 rounded-xl font-black text-[10px] shadow-lg hover:text-white transition-all">+ YENİ ÜRÜN EKLE</button>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar grid grid-cols-3 gap-4">
                  {products.map(p => (
                    <div key={p.id} onClick={() => { if(p.stock > 0) addToCart(p); }} className={`relative flex flex-col items-start p-6 rounded-3xl border transition-all text-left cursor-pointer group ${p.stock > 0 ? 'bg-zinc-950 border-zinc-800 hover:border-lime-400 active:scale-95' : 'bg-red-950/20 border-red-900/30 opacity-50'}`}>
                      <div className="flex justify-between w-full mb-1 items-start">
                        <p className="text-xs font-black uppercase italic text-zinc-500">STOK: {p.stock}</p>
                        <button onClick={(e) => openEditProductModal(e, p)} className="text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-1 rounded-md hover:bg-lime-400 hover:text-black hover:border-lime-400 transition-all z-10 uppercase font-bold">AYAR</button>
                      </div>
                      <p className="text-lg font-black italic text-white tracking-tighter leading-tight mb-4">{p.name}</p>
                      <p className="text-2xl font-black italic text-lime-400 mt-auto">₺{p.price}</p>
                      {p.stock <= 0 && <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-500 text-white font-black text-[10px] px-3 py-1 rounded-md rotate-[-15deg] uppercase pointer-events-none">TÜKENDİ</span>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-[1] bg-zinc-950 border border-zinc-900 rounded-[3rem] p-8 flex flex-col overflow-hidden shadow-2xl">
                <h3 className="text-sm font-black italic text-zinc-500 uppercase tracking-[0.3em] mb-6 border-b border-zinc-800 pb-4">Aktif Sepet</h3>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                  {cart.length === 0 ? (
                     <div className="h-full flex items-center justify-center text-zinc-700 font-black uppercase italic tracking-widest text-xs">Sepet Boş</div>
                  ) : (
                    cart.map(item => (
                      <div key={item.id} className="bg-zinc-900 p-4 rounded-2xl flex justify-between items-center group">
                        <div>
                          <p className="font-black text-sm uppercase italic text-white tracking-tighter">{item.name}</p>
                          <p className="text-[10px] text-lime-400 font-bold">{item.quantity} ADET x ₺{item.price}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="font-black italic text-lg">₺{item.price * item.quantity}</p>
                          <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-6 border-t border-zinc-800 pt-6 shrink-0">
                  <div className="flex justify-between items-end mb-6">
                    <p className="text-xs font-black uppercase text-zinc-500 tracking-widest">TOPLAM TUTAR</p>
                    <p className="text-5xl font-black italic text-white">₺{cartTotal}</p>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => handleCheckout('NAKİT')} disabled={cart.length === 0 || loading} className="flex-1 bg-lime-400 text-black py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100">NAKİT TAHSİLAT</button>
                    <button onClick={() => handleCheckout('KART')} disabled={cart.length === 0 || loading} className="flex-1 bg-zinc-800 text-white border border-zinc-700 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:bg-zinc-700 active:scale-95 transition-all disabled:opacity-50 disabled:hover:bg-zinc-800">KARTLA TAHSİLAT</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentTab === 'reports' && (
            <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-500">
              <div className="grid grid-cols-3 gap-6 mb-6 shrink-0">
                <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2rem]">
                  <p className="text-[10px] text-zinc-500 font-black uppercase mb-2 italic">Toplam Gelir</p>
                  <p className="text-4xl font-black italic text-lime-400">₺{totalIncome.toLocaleString('tr-TR')}</p>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2rem]">
                  <p className="text-[10px] text-zinc-500 font-black uppercase mb-2 italic">Toplam Gider</p>
                  <p className="text-4xl font-black italic text-red-500">₺{totalExpense.toLocaleString('tr-TR')}</p>
                </div>
                <div className={`border p-6 rounded-[2rem] ${netBalance >= 0 ? 'bg-lime-400/10 border-lime-400/30' : 'bg-red-500/10 border-red-500/30'}`}>
                  <p className="text-[10px] text-zinc-400 font-black uppercase mb-2 italic">Net Kasa (Kâr/Zarar)</p>
                  <p className={`text-4xl font-black italic ${netBalance >= 0 ? 'text-lime-400' : 'text-red-500'}`}>₺{netBalance.toLocaleString('tr-TR')}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6 mb-8 shrink-0">
                <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-3xl flex justify-between items-center">
                  <p className="text-[10px] text-zinc-600 font-black uppercase italic">Nakit Kasa</p>
                  <p className="text-xl font-black italic text-white">₺{cashBalance.toLocaleString('tr-TR')}</p>
                </div>
                <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-3xl flex justify-between items-center">
                  <p className="text-[10px] text-zinc-600 font-black uppercase italic">Kredi Kartı</p>
                  <p className="text-xl font-black italic text-white">₺{cardBalance.toLocaleString('tr-TR')}</p>
                </div>
                <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-3xl flex justify-between items-center">
                  <p className="text-[10px] text-zinc-600 font-black uppercase italic">Aylık Tahmini MRR</p>
                  <p className="text-xl font-black italic text-zinc-400">₺{mrr.toLocaleString('tr-TR')}</p>
                </div>
              </div>

              <div className="flex-1 bg-zinc-900/30 border border-zinc-900 rounded-[3rem] p-8 flex flex-col overflow-hidden shadow-2xl">
                <div className="flex justify-between items-center mb-6 border-b border-zinc-800/50 pb-4 shrink-0">
                  <h3 className="text-lg font-black italic text-white uppercase tracking-tighter">Son Finansal İşlemler</h3>
                  <button onClick={() => setShowFinanceModal(true)} className="bg-lime-400 text-black px-6 py-2 rounded-xl font-black uppercase text-[10px] italic hover:scale-105 active:scale-95 transition-all shadow-lg">+ İŞLEM EKLE</button>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                  {transactions.length > 0 ? transactions.map((t) => (
                    <div key={t.id} className="bg-zinc-950/80 border border-zinc-800 p-4 rounded-2xl flex justify-between items-center group hover:border-zinc-600 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-8 rounded-full ${t.type === 'GELİR' ? 'bg-lime-400 shadow-[0_0_8px_#a3e635]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`}></div>
                        <div>
                          <p className="font-black text-sm uppercase italic text-white tracking-tighter">{t.description}</p>
                          <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">{new Date(t.created_at).toLocaleDateString('tr-TR')} - {t.method}</p>
                        </div>
                      </div>
                      <div className={`text-xl font-black italic ${t.type === 'GELİR' ? 'text-lime-400' : 'text-red-500'}`}>
                        {t.type === 'GELİR' ? '+' : '-'}₺{Number(t.amount).toLocaleString('tr-TR')}
                      </div>
                    </div>
                  )) : (
                    <div className="h-full flex items-center justify-center text-zinc-700 font-black uppercase italic tracking-widest text-xs">Henüz işlem bulunmuyor.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* AYARLAR PANELİ */}
          {currentTab === 'settings' && (userProfile?.role === 'superadmin' || userProfile?.role === 'admin') && (
            <div className="flex-1 flex gap-8 overflow-y-auto custom-scrollbar animate-in fade-in duration-500 items-start justify-center pt-10 pb-10">
               <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-900 rounded-[3rem] p-10 shadow-2xl shrink-0">
                 <h3 className="text-2xl font-black italic text-lime-400 mb-8 uppercase tracking-tighter border-b border-zinc-800 pb-4">ŞUBE ÜCRET AYARLARI</h3>
                 <form onSubmit={handleUpdatePrices} className="space-y-6">
                   {['1', '3', '6', '12'].map(month => (
                     <div key={month} className="flex justify-between items-center bg-zinc-900 border border-zinc-800 p-6 rounded-2xl group hover:border-lime-400/30 transition-colors">
                        <span className="font-black text-sm uppercase text-zinc-300 group-hover:text-white transition-colors">{month} Aylık Paket Ücreti (₺)</span>
                        <input type="number" required className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-right font-black w-32 outline-none text-lime-400 focus:border-lime-400 transition-colors"
                          value={membershipPrices[month] || ''}
                          onChange={e => setMembershipPrices({...membershipPrices, [month]: e.target.value})} />
                     </div>
                   ))}
                   <div className="pt-4 mt-8 border-t border-zinc-900">
                     <button type="submit" disabled={loading} className="w-full bg-lime-400 text-black py-5 rounded-2xl font-black uppercase italic shadow-[0_0_20px_rgba(163,230,53,0.1)] active:scale-95 transition-all text-sm tracking-widest">
                       {loading ? 'KAYDEDİLİYOR...' : 'AYARLARI KAYDET'}
                     </button>
                   </div>
                 </form>
               </div>
            </div>
          )}

          {/* SUPER ADMIN PANELİ: YENİ SALON VE PATRON OLUŞTURMA FORMU */}
          {currentTab === 'superadmin' && userProfile?.role === 'superadmin' && (
            <div className="flex-1 flex gap-8 overflow-hidden animate-in fade-in duration-500">
              <div className="flex-1 bg-red-500/5 border border-red-500/20 rounded-[3rem] p-10 flex flex-col overflow-hidden shadow-2xl">
                 <div className="mb-8 border-b border-red-500/20 pb-4">
                    <h3 className="text-2xl font-black italic text-red-500 uppercase tracking-tighter">LIFTRIX AĞI (TÜM SALONLAR)</h3>
                    <p className="text-xs text-zinc-400 mt-2 font-bold uppercase tracking-widest">Sisteme kayıtlı aktif şubeler</p>
                 </div>
                 <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                    {allGyms.map(gym => (
                      <div key={gym.id} className="bg-zinc-950 border border-zinc-800 p-6 rounded-3xl flex justify-between items-center">
                         <div>
                            <p className="text-xl font-black text-white italic tracking-tighter uppercase">{gym.name}</p>
                            <p className="text-[10px] text-lime-400 font-mono mt-1">{gym.id}</p>
                         </div>
                         <div className="text-right">
                           <p className="text-[9px] text-zinc-600 uppercase font-black">Kayıt Tarihi</p>
                           <p className="text-xs font-bold text-zinc-400">{new Date(gym.created_at).toLocaleDateString('tr-TR')}</p>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
              
              <div className="w-96 bg-zinc-950 border border-zinc-900 rounded-[3rem] p-8 flex flex-col overflow-y-auto custom-scrollbar">
                 <h4 className="text-sm font-black text-white uppercase italic tracking-widest mb-6 border-b border-zinc-800 pb-4">+ YENİ ŞUBE & PATRON EKLE</h4>
                 <form onSubmit={handleAddNewGym} className="space-y-4 flex-1">
                    <div className="space-y-2">
                       <p className="text-[9px] text-zinc-500 font-black uppercase pl-2">Sistem Kimliği (ID)</p>
                       <input type="text" required placeholder="Örn: UPGYM-ANKARA-MERKEZ" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs font-bold text-white outline-none uppercase" value={newGym.id} onChange={e => setNewGym({...newGym, id: e.target.value.replace(/\s+/g, '-').toUpperCase()})} />
                    </div>
                    <div className="space-y-2">
                       <p className="text-[9px] text-zinc-500 font-black uppercase pl-2">Görünen Ad</p>
                       <input type="text" required placeholder="Örn: UP GYM Merkez" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs font-bold text-white outline-none uppercase" value={newGym.name} onChange={e => setNewGym({...newGym, name: e.target.value})} />
                    </div>
                    
                    <div className="space-y-2 mt-4 border-t border-zinc-800 pt-4">
                       <p className="text-[9px] text-lime-400 font-black uppercase pl-2">Patron E-Posta</p>
                       <input type="email" required placeholder="patron@upgym.com" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs font-bold text-white outline-none lowercase" value={newGym.adminEmail} onChange={e => setNewGym({...newGym, adminEmail: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                       <p className="text-[9px] text-lime-400 font-black uppercase pl-2">Geçici Şifre</p>
                       <input type="text" required placeholder="123456" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs font-bold text-white outline-none" value={newGym.adminPassword} onChange={e => setNewGym({...newGym, adminPassword: e.target.value})} />
                    </div>

                    <button type="submit" disabled={loading} className="w-full mt-6 bg-red-600 hover:bg-red-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(220,38,38,0.2)] active:scale-95 transition-all">
                      {loading ? 'SİSTEM KURULUYOR...' : 'SİSTEMİ OTO-KUR'}
                    </button>
                 </form>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* MODALLAR */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-6 text-left">
          <div className="bg-zinc-950 border border-zinc-800 p-10 rounded-[3rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-8"><h3 className="text-2xl font-black italic text-lime-400 uppercase tracking-tighter">{newProduct.id ? 'ÜRÜN DÜZENLE' : 'YENİ ÜRÜN EKLE'}</h3>{newProduct.id && (<button type="button" onClick={handleDeleteProduct} className="bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all italic">SİL</button>)}</div>
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <input type="text" placeholder="ÜRÜN ADI (Örn: LIFTRIX Havlu)" required className="w-full bg-zinc-900 border-none rounded-xl p-4 text-sm font-bold text-white outline-none uppercase" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-4"><input type="number" placeholder="SATIŞ FİYATI (₺)" required className="w-full bg-zinc-900 border-none rounded-xl p-4 text-sm font-bold text-white outline-none uppercase" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} /><input type="number" placeholder="STOK ADEDİ" required className="w-full bg-zinc-900 border-none rounded-xl p-4 text-sm font-bold text-white outline-none uppercase" value={newProduct.stock} onChange={e => setNewProduct({ ...newProduct, stock: e.target.value })} /></div>
              <div className="flex gap-4 pt-4"><button type="button" onClick={() => setShowProductModal(false)} className="flex-1 bg-zinc-900 text-white py-4 rounded-xl font-black text-xs uppercase transition-all">İPTAL</button><button type="submit" disabled={loading} className="flex-1 bg-lime-400 text-black py-4 rounded-xl font-black text-xs uppercase shadow-lg active:scale-95">{loading ? 'KAYDEDİLİYOR...' : 'KAYDET'}</button></div>
            </form>
          </div>
        </div>
      )}

      {showClassModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-6 text-left">
          <div className="bg-zinc-950 border border-zinc-800 p-10 rounded-[3rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black italic text-lime-400 mb-8 uppercase tracking-tighter">YENİ DERS PROGRAMLA</h3>
            <form onSubmit={handleAddClass} className="space-y-4">
              <input type="text" placeholder="DERS ADI" required className="w-full bg-zinc-900 border-none rounded-xl p-4 text-sm font-bold text-white outline-none uppercase" onChange={e => setNewClass({ ...newClass, name: e.target.value })} />
              <input type="text" placeholder="EĞİTMEN" required className="w-full bg-zinc-900 border-none rounded-xl p-4 text-sm font-bold text-white outline-none uppercase" onChange={e => setNewClass({ ...newClass, trainer: e.target.value })} />
              <div className="grid grid-cols-2 gap-4"><select className="bg-zinc-900 text-white p-4 rounded-xl text-xs font-bold outline-none" onChange={e => setNewClass({ ...newClass, day: e.target.value })}>{['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'].map(d => <option key={d} value={d}>{d}</option>)}</select><input type="time" className="bg-zinc-900 text-white p-4 rounded-xl text-xs font-bold outline-none" onChange={e => setNewClass({ ...newClass, time: e.target.value })} /></div>
              <input type="number" placeholder="KONTENJAN (KİŞİ)" className="w-full bg-zinc-900 border-none rounded-xl p-4 text-sm font-bold text-white outline-none" onChange={e => setNewClass({ ...newClass, capacity: parseInt(e.target.value) })} />
              <div className="flex gap-4 pt-4"><button type="button" onClick={() => setShowClassModal(false)} className="flex-1 bg-zinc-900 text-white py-4 rounded-xl font-black text-xs uppercase transition-all">İPTAL</button><button type="submit" disabled={loading} className="flex-1 bg-lime-400 text-black py-4 rounded-xl font-black text-xs uppercase shadow-lg active:scale-95">{loading ? 'KAYDEDİLİYOR...' : 'OLUŞTUR'}</button></div>
            </form>
          </div>
        </div>
      )}

      {showFinanceModal && (userProfile?.role === 'superadmin' || userProfile?.role === 'admin') && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-6 text-left">
          <div className="bg-zinc-950 border border-zinc-800 p-10 rounded-[3rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black italic text-lime-400 mb-8 uppercase tracking-tighter">FİNANSAL İŞLEM EKLE</h3>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><p className="text-[9px] text-zinc-500 font-black uppercase pl-1">İşlem Tipi</p><select className="w-full bg-zinc-900 border-none rounded-xl p-4 text-xs font-bold text-white outline-none" value={newTx.type} onChange={e => setNewTx({ ...newTx, type: e.target.value })}><option value="GELİR">GELİR (+)</option><option value="GİDER">GİDER (-)</option></select></div><div className="space-y-1"><p className="text-[9px] text-zinc-500 font-black uppercase pl-1">Ödeme Yöntemi</p><select className="w-full bg-zinc-900 border-none rounded-xl p-4 text-xs font-bold text-white outline-none" value={newTx.method} onChange={e => setNewTx({ ...newTx, method: e.target.value })}><option value="NAKİT">NAKİT</option><option value="KART">KREDİ KARTI</option></select></div></div>
              <input type="number" placeholder="TUTAR (₺)" required className="w-full bg-zinc-900 border-none rounded-xl p-4 text-xl font-black text-white outline-none uppercase" value={newTx.amount} onChange={e => setNewTx({ ...newTx, amount: e.target.value })} />
              <input type="text" placeholder="AÇIKLAMA (Örn: Fatura)" required className="w-full bg-zinc-900 border-none rounded-xl p-4 text-sm font-bold text-white outline-none uppercase" value={newTx.description} onChange={e => setNewTx({ ...newTx, description: e.target.value })} />
              <div className="flex gap-4 pt-4"><button type="button" onClick={() => setShowFinanceModal(false)} className="flex-1 bg-zinc-900 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all">İPTAL</button><button type="submit" disabled={loading} className={`flex-1 text-black py-4 rounded-xl font-black text-xs uppercase shadow-lg active:scale-95 ${newTx.type === 'GELİR' ? 'bg-lime-400' : 'bg-red-500 text-white'}`}>{loading ? 'KAYDEDİLİYOR...' : 'İŞLEMİ KAYDET'}</button></div>
            </form>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-6 text-left">
          <div className="bg-zinc-950 border border-zinc-800 p-10 rounded-[3rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black italic text-lime-400 mb-8 uppercase tracking-tighter">YENİ KAYIT & TAHSİLAT</h3>
            <form onSubmit={handleAddMember} className="space-y-4">
              <input type="text" placeholder="AD SOYAD" required className="w-full bg-zinc-900 border-none rounded-xl p-4 text-sm font-bold text-white outline-none uppercase" onChange={e => setNewMember({ ...newMember, full_name: e.target.value })} />
              <input type="text" placeholder="TELEFON" className="w-full bg-zinc-900 border-none rounded-xl p-4 text-sm font-bold text-white outline-none uppercase" onChange={e => setNewMember({ ...newMember, phone: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[9px] text-zinc-500 font-black uppercase pl-1">Süre Seçimi</p>
                  <select className="w-full bg-zinc-900 border-none rounded-xl p-4 text-xs font-bold text-white outline-none" onChange={e => setNewMember({ ...newMember, membership_duration: e.target.value })}>
                    <option value="1">1 AY (₺{membershipPrices['1']})</option>
                    <option value="3">3 AY (₺{membershipPrices['3']})</option>
                    <option value="6">6 AY (₺{membershipPrices['6']})</option>
                    <option value="12">12 AY (₺{membershipPrices['12']})</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] text-zinc-500 font-black uppercase pl-1">Cinsiyet</p>
                  <select className="w-full bg-zinc-900 border-none rounded-xl p-4 text-xs font-bold text-white outline-none" onChange={e => setNewMember({ ...newMember, gender: e.target.value })}>
                    <option value="Erkek">ERKEK</option><option value="Kadın">KADIN</option>
                  </select>
                </div>
              </div>
              <textarea placeholder="PROGRAM" className="w-full bg-zinc-900 border-none rounded-xl p-4 text-sm font-bold text-white h-20 outline-none uppercase" onChange={e => setNewMember({ ...newMember, current_program: e.target.value })}></textarea>
              <textarea placeholder="NOTLAR" className="w-full bg-zinc-900 border-none rounded-xl p-4 text-sm font-bold text-white h-20 outline-none uppercase" onChange={e => setNewMember({ ...newMember, injury_notes: e.target.value })}></textarea>
              
              <div className="bg-lime-400/10 border border-lime-400/20 p-3 rounded-xl mt-2">
                <p className="text-[9px] text-lime-400 font-black uppercase text-center italic tracking-widest">
                  Not: Kayıt tamamlandığında ₺{membershipPrices[newMember.membership_duration]} kasaya otomatik işlenecektir.
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 bg-zinc-900 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all">İPTAL</button>
                <button type="submit" disabled={loading} className="flex-1 bg-lime-400 text-black py-4 rounded-xl font-black text-xs uppercase shadow-lg active:scale-95">{loading ? 'İŞLENİYOR...' : 'KAYDI VE TAHSİLATI YAP'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
