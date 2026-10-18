import { useState, useEffect, useCallback } from 'react';
import { UserAccount, Gig, Project, Proposal, Order, Dispute, Refund, Payout, Category, Review, SupportTicket, AuditLog, Message } from '../types';
import { initialUsers, initialGigs, initialProjects, initialOrders } from '../data/mockData';
import { getAuthToken } from '../utils/authToken';
import { getDeviceId } from '../utils/deviceId';


export const useAppData = (initialData?: any) => {
  const [users, setUsers] = useState<UserAccount[]>(initialData?.users ?? initialUsers);
  const [gigs, setGigs] = useState<Gig[]>(initialData?.gigs ?? initialGigs);
  const [projects, setProjects] = useState<Project[]>(initialData?.projects ?? initialProjects);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [categories, setCategories] = useState<Category[]>(initialData?.categories ?? []);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [userEmails, setUserEmails] = useState<string[]>([]);
  
  const [platformFee, setPlatformFee] = useState<number>(0);
  const [clientServiceFee, setClientServiceFee] = useState<number>(0);
  const [smallOrderFeeThreshold, setSmallOrderFeeThreshold] = useState<number>(0);
  const [smallOrderFeeAmount, setSmallOrderFeeAmount] = useState<number>(0);
  const [escrowProtectionDays, setEscrowProtectionDays] = useState<number>(0);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserEmails = async (userId: string) => {
    try {
      const res = await fetch(`/api/user-emails/${userId}`);
      if (res.ok) setUserEmails(await res.json());
    } catch (e) {
      console.error(e);
    }
  };



  const safeJson = async (res: Response, fallback: any = []) => {
    if (!res.ok) return fallback;
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) return fallback;
    try {
      return await res.json();
    } catch {
      return fallback;
    }
  };

  const fetchData = useCallback(async (currentUserId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      const authHeaders: Record<string, string> = {
        'x-device-id': getDeviceId(),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      const reqOpt = { headers: authHeaders };

      let userRole: string | null = null;
      try {
        if (typeof window !== 'undefined') {
          const cached = localStorage.getItem('current_user') || localStorage.getItem('user');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed?.role) userRole = parsed.role;
          }
        }
        if (!userRole && token) {
          const [b64] = token.split('.');
          if (b64 && typeof atob === 'function') {
            const json = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
            const payload = JSON.parse(json);
            if (payload?.role) userRole = payload.role;
          }
        }
      } catch {}

      const isAdminOrSupport = Boolean(userRole && ['admin', 'super_admin', 'support'].includes(userRole));

      const [uRes, gRes, pRes, prRes, oRes, cRes, revRes] = await Promise.all([
        fetch('/api/users', reqOpt),
        fetch('/api/gigs', reqOpt),
        fetch('/api/projects', reqOpt),
        fetch('/api/proposals', reqOpt),
        fetch('/api/orders', reqOpt),
        fetch('/api/categories', reqOpt),
        fetch('/api/reviews', reqOpt)
      ]);

      const usersData = uRes.ok ? await safeJson(uRes, []) : [];
      const gigsData = gRes.ok ? await safeJson(gRes, []) : [];
      const projectsData = pRes.ok ? await safeJson(pRes, []) : [];
      const proposalsData = prRes.ok ? await safeJson(prRes, []) : [];
      const ords = oRes.ok ? await safeJson(oRes, []) : [];
      const categoriesData = cRes.ok ? await safeJson(cRes, []) : [];
      const reviewsData = revRes.ok ? await safeJson(revRes, []) : [];

      setUsers(usersData);
      setGigs(gigsData);

      if (projectsData.length > 0) setProjects(projectsData);
      if (proposalsData.length > 0) setProposals(proposalsData);
      if (ords.length > 0) setOrders(ords);
      if (categoriesData.length > 0) setCategories(categoriesData);
      if (reviewsData.length > 0) setReviews(reviewsData);

      if (isAdminOrSupport) {
        const [dRes, rRes, payRes, sRes, aRes, setRes] = await Promise.all([
          fetch('/api/disputes', reqOpt),
          fetch('/api/refunds', reqOpt),
          fetch('/api/payouts', reqOpt),
          fetch('/api/support-tickets', reqOpt),
          fetch('/api/audit-logs', reqOpt),
          fetch('/api/admin/settings', reqOpt)
        ]);

        const disputesData = dRes.ok ? await safeJson(dRes, []) : [];
        const refundsData = rRes.ok ? await safeJson(rRes, []) : [];
        const payoutsData = payRes.ok ? await safeJson(payRes, []) : [];
        const supportTicketsData = sRes.ok ? await safeJson(sRes, []) : [];
        const auditLogsData = aRes.ok ? await safeJson(aRes, []) : [];
        const settingsData = setRes.ok ? await safeJson(setRes, null) : null;

        if (disputesData.length > 0) setDisputes(disputesData);
        if (refundsData.length > 0) setRefunds(refundsData);
        if (payoutsData.length > 0) setPayouts(payoutsData);
        if (supportTicketsData.length > 0) setSupportTickets(supportTicketsData);
        if (auditLogsData.length > 0) setAuditLogs(auditLogsData);

        if (settingsData) {
          if (settingsData.freelancerCommissionRate !== undefined) setPlatformFee(settingsData.freelancerCommissionRate);
          if (settingsData.clientServiceFee !== undefined) setClientServiceFee(settingsData.clientServiceFee);
          if (settingsData.smallOrderFeeThreshold !== undefined) setSmallOrderFeeThreshold(settingsData.smallOrderFeeThreshold);
          if (settingsData.smallOrderFeeAmount !== undefined) setSmallOrderFeeAmount(settingsData.smallOrderFeeAmount);
          if (settingsData.escrowHoldDays !== undefined) setEscrowProtectionDays(settingsData.escrowHoldDays);
        }
      }
    } catch (e) {
      setError('Failed to fetch data');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    users, setUsers,
    gigs, setGigs,
    projects, setProjects,
    proposals, setProposals,
    orders, setOrders,
    reviews, setReviews,
    messages, setMessages,
    disputes, setDisputes,
    refunds, setRefunds,
    payouts, setPayouts,
    categories, setCategories,
    supportTickets, setSupportTickets,
    auditLogs, setAuditLogs,
    userEmails, setUserEmails, fetchUserEmails,
    platformFee, setPlatformFee,
    clientServiceFee, setClientServiceFee,
    smallOrderFeeThreshold, setSmallOrderFeeThreshold,
    smallOrderFeeAmount, setSmallOrderFeeAmount,
    escrowProtectionDays, setEscrowProtectionDays,
    isLoading,
    error,
    refresh: fetchData
  };
};
