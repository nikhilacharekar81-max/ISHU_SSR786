import React, { useEffect, useRef, useState } from 'react';
import { formatMessageTime } from '../../utils/messageTime';
import { 
  FileText, Download, ShieldCheck, Activity, CheckCircle2, 
  Clock, AlertTriangle, MessageSquare, ArrowDown, Sparkles,
  FileSignature, Receipt, Lock, Loader2, RotateCcw, ExternalLink
} from 'lucide-react';
import { WorkstreamMessage, WorkstreamOffer } from './types';
import { UserAccount } from '../../types';

interface WorkstreamActivityStreamProps {
  messages: WorkstreamMessage[];
  currentUserId?: string;
  usersList?: UserAccount[];
  partnerUser?: UserAccount;
  onDownloadFile?: (fileInfo: { name: string; url: string }) => void;
  /** Real offer records for this workstream (the source of truth for every offer card). */
  offers?: WorkstreamOffer[];
  buyerId?: string;
  sellerId?: string;
  orderAmount?: number;
  escrowRemaining?: number;
  orderReview?: any;
  sellerReview?: any;
  onOfferAction?: (offerId: string, action: 'accept' | 'decline' | 'cancel') => Promise<{ ok: boolean; error?: string }>;
  onRequestRevisionFromInvoice?: () => void;
  onReplyReview?: (reviewId: string, replyText: string) => Promise<{ ok: boolean; error?: string }>;
  onRetryMessage?: (msg: WorkstreamMessage) => void;
}

export const WorkstreamActivityStream: React.FC<WorkstreamActivityStreamProps> = ({
  messages,
  currentUserId,
  usersList = [],
  partnerUser,
  onDownloadFile,
  offers = [],
  buyerId,
  sellerId,
  orderAmount,
  escrowRemaining,
  orderReview,
  sellerReview,
  onOfferAction,
  onRequestRevisionFromInvoice,
  onReplyReview,
  onRetryMessage
}) => {
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);
  const [confirmingOffer, setConfirmingOffer] = useState<{ offer: WorkstreamOffer; action: 'accept' | 'decline' | 'cancel' } | null>(null);
  const [offerError, setOfferError] = useState<{ id: string; message: string } | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const KIND_CFG = {
    proposal: { label: 'Proposal', icon: <FileSignature className="w-4 h-4" />, accept: 'Accept & Fund Escrow' },
    invoice: { label: 'Invoice', icon: <Receipt className="w-4 h-4" />, accept: 'Pay Invoice & Release Escrow' },
    deposit: { label: 'Deposit Request', icon: <Lock className="w-4 h-4" />, accept: 'Fund Escrow Deposit' }
  } as const;
  const STATUS_CFG: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Awaiting buyer', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    accepted: { label: 'Escrow Funded', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    paid: { label: 'Paid & Released', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    declined: { label: 'Declined', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500 border-slate-200' }
  };

  const executeOfferAction = async (offer: WorkstreamOffer, action: 'accept' | 'decline' | 'cancel') => {
    if (!onOfferAction || busyOfferId) return;
    setConfirmingOffer(null);
    setBusyOfferId(offer.id);
    setOfferError(null);
    const result = await onOfferAction(offer.id, action);
    setBusyOfferId(null);
    if (!result.ok) setOfferError({ id: offer.id, message: result.error || 'Action failed.' });
  };

  const renderOfferCard = (msg: WorkstreamMessage, isMe: boolean, keyStr: string) => {
    const offer = offers.find(o => o.id === msg.metadata?.offerId);
    if (!offer) {
      return (
        <div key={keyStr} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
          <div className="max-w-md bg-white border border-slate-200 rounded-3xl px-4 py-3 text-xs text-slate-400 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading {msg.text}...
          </div>
        </div>
      );
    }
    const cfg = KIND_CFG[offer.kind];
    const st = STATUS_CFG[offer.status] || STATUS_CFG.pending;
    const sym = offer.currencySymbol || '$';
    const iAmBuyer = !!currentUserId && currentUserId === buyerId;
    const iAmSeller = !!currentUserId && currentUserId === sellerId;
    const busy = busyOfferId === offer.id;
    const activeEscrow = escrowRemaining !== undefined ? Number(escrowRemaining) : Number(orderAmount || 0);
    const hasAdditional = offer.kind === 'invoice' && offer.amount > activeEscrow;
    const offerFiles = Array.isArray(offer.files) && offer.files.length > 0
      ? offer.files
      : (Array.isArray(msg.metadata?.files) ? msg.metadata.files : []);
    const offerRef = offer.reference || msg.metadata?.reference;
    const isConfirmingThis = confirmingOffer?.offer.id === offer.id;

    return (
      <div key={keyStr} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div className="w-full max-w-md bg-white border border-emerald-200 rounded-3xl shadow-xs overflow-hidden">
          <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              <span className="text-emerald-600">{cfg.icon}</span>{cfg.label} {offer.number}
            </span>
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${st.cls}`}>
              {offer.status === 'pending' && iAmSeller ? 'Awaiting buyer payment' : st.label}
            </span>
          </div>
          <div className="p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-bold text-fiverr-dark">{offer.title}</p>
              <p className="text-xl font-black text-fiverr-dark font-mono shrink-0">{sym}{offer.amount.toLocaleString()}</p>
            </div>

            {offer.kind === 'invoice' && offer.status === 'pending' && (
              <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 font-medium">
                {hasAdditional ? (
                  <span>
                    Escrow available: <strong>{sym}{activeEscrow.toLocaleString()}</strong> + <strong>{sym}{(offer.amount - activeEscrow).toLocaleString()}</strong> additional from wallet
                  </span>
                ) : (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    100% covered by Escrow Deposit ({sym}{activeEscrow.toLocaleString()} held)
                  </span>
                )}
              </div>
            )}

            {offer.deliveryDays && (
              <p className="text-[11px] text-slate-500">
                Delivery in <strong>{offer.deliveryDays}</strong> day{offer.deliveryDays === 1 ? '' : 's'}
              </p>
            )}
            {offer.note && (
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                {offer.note}
              </p>
            )}

            {offerRef && (
              <div className="flex items-center gap-2 text-[11px] text-emerald-700 bg-emerald-50/60 px-3 py-1.5 rounded-xl border border-emerald-100">
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate font-medium">{offerRef}</span>
              </div>
            )}

            {offerFiles.length > 0 && (
              <div className="pt-1 space-y-1.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Attached Deliverables ({offerFiles.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {offerFiles.map((f: any, idx: number) => (
                    <button
                      key={`${offer.id}-f-${idx}`}
                      type="button"
                      onClick={() => onDownloadFile?.(f)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-200 rounded-xl text-[11px] font-bold transition cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate max-w-[180px]">{f.name || 'Deliverable'}</span>
                      <Download className="w-3 h-3 text-slate-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {offer.status === 'pending' && iAmBuyer && !isConfirmingThis && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmingOffer({ offer, action: 'accept' })}
                    className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs"
                  >
                    {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{cfg.accept}</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => executeOfferAction(offer, 'decline')}
                    className="px-3.5 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    Decline
                  </button>
                </div>
                {offer.kind === 'invoice' && onRequestRevisionFromInvoice && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onRequestRevisionFromInvoice}
                    className="w-full py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Request Modification / Revision</span>
                  </button>
                )}
              </div>
            )}

            {isConfirmingThis && confirmingOffer?.action === 'accept' && (
              <div className="mt-2 p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-200 space-y-2.5 animate-in fade-in">
                <p className="text-xs font-bold text-emerald-950">
                  {offer.kind === 'invoice'
                    ? `Confirm Payment of Invoice ${offer.number} (${sym}${offer.amount.toLocaleString()})`
                    : `Confirm ${cfg.accept} (${sym}${offer.amount.toLocaleString()})`}
                </p>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  {offer.kind === 'invoice' ? (
                    hasAdditional ? (
                      <>Releases <strong>{sym}{activeEscrow.toLocaleString()}</strong> from Escrow and charges <strong>{sym}{Number(offer.clientAdditionalTotal ?? (offer.amount - activeEscrow)).toLocaleString()}</strong> (incl. fee) from your wallet to the seller.</>
                    ) : (
                      <>Releases <strong>{sym}{offer.amount.toLocaleString()}</strong> directly from your funded Escrow deposit to the seller's wallet. No extra charge to your wallet.</>
                    )
                  ) : (
                    <>Funds <strong>{sym}{offer.amount.toLocaleString()}</strong> into WorkStream Escrow (total wallet debit: <strong>{sym}{Number(offer.clientTotal ?? offer.amount).toLocaleString()}</strong> incl. processing fees).</>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => executeOfferAction(offer, 'accept')}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm & Proceed</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmingOffer(null)}
                    className="py-2 px-3 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {offer.status === 'pending' && iAmSeller && (
              <button
                type="button"
                disabled={busy}
                onClick={() => executeOfferAction(offer, 'cancel')}
                className="mt-1 px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel {cfg.label.toLowerCase()}
              </button>
            )}
            {offerError?.id === offer.id && (
              <p className="text-[11px] font-semibold text-rose-600 pt-1">{offerError.message}</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
      {messages.map((msg, index) => {
        const uniqueKey = `${msg.id || 'msg'}-${index}`;
        const isMe = msg.senderId === currentUserId;

        if (msg.metadata?.action === 'offer_created' && msg.metadata?.offerId) {
          return renderOfferCard(msg, isMe, uniqueKey);
        }

        if (msg.type === 'system') {
          const action = msg.metadata?.action || '';
          const delivFiles = Array.isArray(msg.metadata?.files) ? msg.metadata.files : [];
          const iAmSeller = !!currentUserId && currentUserId === sellerId;
          const canSellerReplyToReview = action === 'review_submitted' && iAmSeller && orderReview?.id && !orderReview?.reply && !!onReplyReview && msg.metadata?.reviewerRole !== 'seller';

          let pillCls = 'text-slate-600 bg-slate-50 border-slate-200';
          if (['escrow_released', 'deliverable_approved', 'order_completed', 'order_auto_accepted', 'offer_paid'].includes(action)) {
            pillCls = 'text-emerald-800 bg-emerald-50/90 border-emerald-200';
          } else if (['escrow_funded', 'offer_accepted', 'order_created'].includes(action)) {
            pillCls = 'text-blue-800 bg-blue-50/90 border-blue-200';
          } else if (action === 'deliverable_submitted') {
            pillCls = 'text-slate-800 bg-amber-50/80 border-amber-200';
          } else if (['revision_requested', 'revision_resolved'].includes(action)) {
            pillCls = 'text-purple-800 bg-purple-50/90 border-purple-200';
          } else if (['dispute_opened', 'dispute_resolved', 'escrow_refunded', 'offer_declined', 'offer_cancelled'].includes(action)) {
            pillCls = 'text-rose-800 bg-rose-50/90 border-rose-200';
          } else if (['review_submitted', 'review_reply_submitted'].includes(action)) {
            pillCls = 'text-amber-900 bg-amber-50/90 border-amber-200';
          }

          return (
            <div key={uniqueKey} className="flex flex-col items-center gap-2">
              <div className={`text-[11px] font-medium px-4 py-2 rounded-2xl border max-w-xl text-center shadow-2xs ${pillCls}`}>
                <div>{msg.text}</div>
                {delivFiles.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-amber-200/70 flex flex-wrap items-center justify-center gap-2">
                    {delivFiles.map((f: any, fIdx: number) => (
                      <button
                        key={`${uniqueKey}-f-${fIdx}`}
                        type="button"
                        onClick={() => onDownloadFile?.(f)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-amber-100/60 text-slate-800 border border-amber-200 rounded-xl text-[10px] font-bold transition cursor-pointer"
                      >
                        <FileText className="w-3 h-3 text-emerald-600" />
                        <span>{f.name || 'Deliverable'}</span>
                        <Download className="w-3 h-3 text-slate-400" />
                      </button>
                    ))}
                  </div>
                )}
                {canSellerReplyToReview && (
                  <div className="mt-3 pt-2.5 border-t border-amber-200/80 text-left space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-800">
                      Post Public Seller Response
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        placeholder="Thank the client or share your perspective..."
                        className="flex-1 px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        disabled={isSubmittingReply || !replyDraft.trim()}
                        onClick={async () => {
                          if (!onReplyReview || !orderReview?.id || !replyDraft.trim()) return;
                          setIsSubmittingReply(true);
                          setReplyError(null);
                          const res = await onReplyReview(orderReview.id, replyDraft.trim());
                          setIsSubmittingReply(false);
                          if (res.ok) {
                            setReplyDraft('');
                          } else {
                            setReplyError(res.error || 'Failed to post reply.');
                          }
                        }}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-xl text-[11px] transition cursor-pointer"
                      >
                        {isSubmittingReply ? 'Posting...' : 'Reply'}
                      </button>
                    </div>
                    {replyError && <p className="text-[10px] text-rose-600 font-semibold">{replyError}</p>}
                  </div>
                )}
              </div>
            </div>
          );
        }
        
        const senderObj = usersList.find(u => u.id === msg.senderId) || (isMe ? undefined : partnerUser);
        const avatarUrl = msg.senderAvatar || senderObj?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop';
        const senderName = msg.senderName || senderObj?.name || (isMe ? 'You' : 'Partner');

        const isFailed = msg.status === 'failed';
        const isSending = msg.status === 'sending';

        return (
          <div key={uniqueKey} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
            <img src={avatarUrl} alt={senderName} className="w-8 h-8 rounded-full object-cover shrink-0" />
            <div className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] font-bold text-slate-400 px-1">{senderName}</span>
              <div className={`px-4 py-3 rounded-2xl text-xs max-w-sm ${
                isFailed
                  ? 'bg-rose-50 border border-rose-300 text-rose-900 rounded-tr-none'
                  : isMe
                    ? 'bg-slate-900 text-white rounded-tr-none'
                    : 'bg-white border border-slate-200 rounded-tl-none shadow-xs'
              }`}>
                {msg.type === 'file' && msg.fileInfo ? (
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${isFailed ? 'bg-rose-100 text-rose-700' : 'bg-emerald-50 text-emerald-600'}`}><FileText className="w-4 h-4" /></div>
                    <div className="flex-1">
                      <div className="font-bold">{msg.fileInfo.name}</div>
                      <div className="text-[10px] opacity-70">{msg.fileInfo.size}</div>
                    </div>
                    {!isFailed && (
                      <button onClick={() => onDownloadFile?.(msg.fileInfo!)} className="p-2 hover:bg-white/10 rounded-lg cursor-pointer transition">
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                )}
              </div>

              {/* Status and retry bar */}
              <div className="flex items-center gap-1.5 px-1 text-[9px]">
                {isFailed && (
                  <div className="flex items-center gap-1.5 text-rose-600 font-semibold">
                    <AlertTriangle className="w-3 h-3 text-rose-500" />
                    <span>Failed to send</span>
                    {isMe && onRetryMessage && (
                      <button
                        type="button"
                        onClick={() => onRetryMessage(msg)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-md font-bold transition cursor-pointer"
                        title="Retry sending this message"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        <span>Retry</span>
                      </button>
                    )}
                  </div>
                )}
                {isSending && (
                  <div className="flex items-center gap-1 text-slate-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Sending...</span>
                  </div>
                )}
                {!isFailed && !isSending && (
                  <span className="text-slate-400">{formatMessageTime(msg.timestamp)}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={scrollEndRef} />
    </div>
  );
};

