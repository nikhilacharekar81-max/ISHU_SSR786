import React from 'react';
import { 
  ShieldCheck, Calendar, DollarSign, User, CheckCircle2, 
  Star, Briefcase, ExternalLink, Clock, Lock 
} from 'lucide-react';
import { WorkstreamItem } from './types';
import { UserAccount } from '../../types';

interface WorkstreamSummaryCardProps {
  order: WorkstreamItem;
  partner?: UserAccount;
  currentUser?: UserAccount | null;
  escrowRemaining?: number;
  totalReleased?: number;
  currencySymbol?: string;
  onViewPartnerProfile?: (user: UserAccount) => void;
}

export const WorkstreamSummaryCard: React.FC<WorkstreamSummaryCardProps> = ({
  order,
  partner,
  currentUser,
  escrowRemaining,
  totalReleased,
  currencySymbol = '$',
  onViewPartnerProfile
}) => {
  const isBuyer = currentUser?.id === order.buyerId;
  const activeEscrow = escrowRemaining !== undefined ? escrowRemaining : ((order as any).escrowRemaining ?? (order.status === 'completed' ? 0 : Number(order.amount || 0)));
  const releasedAmt = totalReleased !== undefined ? totalReleased : ((order as any).totalReleased ?? (order.status === 'completed' ? Number(order.amount || 0) : 0));

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
      {/* ESCROW & FINANCIAL VALUE HEADER (PeoplePerHour Style) */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl relative overflow-hidden space-y-3">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 block mb-0.5">
              Held in Escrow
            </span>
            <div className="text-2xl font-black tracking-tight font-mono">
              {currencySymbol}{Number(activeEscrow || 0).toLocaleString()}
            </div>
          </div>
          <div className="w-11 h-11 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="relative z-10 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Released / Paid</span>
            <span className="font-mono font-bold text-emerald-300">{currencySymbol}{Number(releasedAmt || 0).toLocaleString()}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Value</span>
            <span className="font-mono font-bold text-white">{currencySymbol}{Number(order.amount || 0).toLocaleString()}</span>
          </div>
        </div>

        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-300">
          <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>
            {activeEscrow > 0
              ? '100% Funded in Escrow Account'
              : releasedAmt > 0
                ? 'Invoice Paid • Ready for Follow-on Proposals'
                : 'Awaiting Proposal Deposit'}
          </span>
        </div>
      </div>

      {/* COLLABORATOR / PARTNER CARD */}
      {partner && (
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            {isBuyer ? 'Assigned Freelancer / Seller' : 'Client / Buyer'}
          </span>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={partner.avatar}
                  alt={partner.name}
                  className="w-11 h-11 rounded-2xl object-cover border border-slate-200"
                />
                {partner.kycStatus === 'verified' && (
                  <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white p-0.5 rounded-full border-2 border-white" title="Verified User">
                    <CheckCircle2 className="w-3 h-3" />
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-fiverr-dark flex items-center gap-1">
                  <span>{partner.name}</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  {partner.ActiveRole || (isBuyer ? 'Specialist' : 'Project Owner')}
                </p>
              </div>
            </div>
            {onViewPartnerProfile && (
              <button
                onClick={() => onViewPartnerProfile(partner)}
                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition cursor-pointer"
                title="View Full Profile"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ORDER METADATA */}
      <div className="space-y-3 pt-4 border-t border-slate-100 text-xs">
        <div className="flex items-center justify-between text-slate-500">
          <span className="flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-slate-400" />
            <span>Workstream Type</span>
          </span>
          <span className="font-bold text-fiverr-dark uppercase text-[10px] px-2.5 py-0.5 bg-slate-100 rounded-md">
            {order.type === 'gig' ? 'Pre-Funded Gig / Offer' : 'Custom Project'}
          </span>
        </div>

        <div className="flex items-center justify-between text-slate-500">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Started Date</span>
          </span>
          <span className="font-semibold text-fiverr-dark">{order.createdAt}</span>
        </div>

        <div className="flex items-center justify-between text-slate-500">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Current Stage</span>
          </span>
          <span className={`font-bold uppercase text-[10px] px-2.5 py-0.5 rounded-full ${
            order.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
            order.status === 'delivered' ? 'bg-amber-50 text-amber-700' :
            order.status === 'revision' ? 'bg-purple-50 text-purple-700' :
            'bg-blue-50 text-blue-700'
          }`}>
            {order.status.replace('_', ' ')}
          </span>
        </div>
      </div>
    </div>
  );
};
