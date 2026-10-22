'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatEther, isAddress, parseEther } from 'viem';
import { sepolia } from 'wagmi/chains';
import { useAccount, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { ArrowUpRight, Bookmark, CircleCheck, Clock3, LoaderCircle, Plus, Search, ShieldCheck, WalletCards, X } from 'lucide-react';
import { campaignCreatedEvent, contractAddress, deploymentBlock, openFundAbi } from '@/lib/openfund';

type Campaign = {
  id: bigint;
  creator: `0x${string}`;
  deadline: bigint;
  goal: bigint;
  raised: bigint;
  claimed: boolean;
  metadataURI: string;
  title: string;
  description: string;
  category: string;
  contribution: bigint;
};

const filters = ['For you', 'All projects', 'Climate', 'Open source', 'Community'];
const preview = [
  {title:'Solar for Sundarbans',category:'CLIMATE',by:'Green Futures Collective',raised:'8.42',goal:'12.00',backers:183,days:12,color:'sun',tag:'TRENDING',mark:'☀',desc:'Bringing reliable, clean energy to 40 homes in coastal villages.'},
  {title:'The Open Source Pantry',category:'OPEN SOURCE',by:'Mira Chen',raised:'3.18',goal:'5.00',backers:96,days:8,color:'pantry',tag:'NEAR GOAL',mark:'🥫',desc:'A community-maintained recipe and food-sharing platform for everyone.'},
  {title:'Reef Radio',category:'COMMUNITY',by:'Ocean Commons',raised:'5.64',goal:'15.00',backers:241,days:24,color:'reef',tag:'JUST LAUNCHED',mark:'🐚',desc:'Underwater sensors that let local communities monitor reef health.'}
];

export function CampaignGallery() {
  const client = usePublicClient({ chainId: sepolia.id });
  const { address, isConnected, chainId } = useAccount();
  const isSepolia = chainId === sepolia.id;
  const { writeContract, data: hash, isPending, error: writeError, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ chainId: sepolia.id, hash });

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('For you');
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [amount, setAmount] = useState('');
  const [goal, setGoal] = useState('');
  const [duration, setDuration] = useState('30');
  const [metadataURI, setMetadataURI] = useState('');
  const [notice, setNotice] = useState('');
  const [currentTime, setCurrentTime] = useState<bigint>(() => BigInt(Math.floor(Date.now() / 1000)));

  const configured = Boolean(contractAddress && isAddress(contractAddress));
  const handledReceiptRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(BigInt(Math.floor(Date.now() / 1000)));
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const refresh = useCallback(async () => {
    if (!contractAddress || !isAddress(contractAddress) || !client) return;
    const targetAddress = contractAddress;
    await Promise.resolve();
    setLoading(true);
    setLoadError('');
    try {
      const logs = await client.getLogs({
        address: targetAddress,
        event: campaignCreatedEvent,
        fromBlock: deploymentBlock,
        toBlock: 'latest',
      });
      const ids = [...new Set(logs.map(log => log.args.campaignId).filter((id): id is bigint => id !== undefined))];
      const next = await Promise.all(
        ids.map(async id => {
          const [data, contribution] = await Promise.all([
            client.readContract({
              address: targetAddress,
              abi: openFundAbi,
              functionName: 'getCampaign',
              args: [id],
            }),
            address
              ? client.readContract({
                  address: targetAddress,
                  abi: openFundAbi,
                  functionName: 'contributions',
                  args: [id, address],
                })
              : Promise.resolve(0n),
          ]);
          let title = `Community project #${id}`;
          let description = 'Campaign metadata is available on-chain.';
          let category = 'Community';
          if (data.metadataURI.startsWith('data:application/json,')) {
            try {
              const meta = JSON.parse(decodeURIComponent(data.metadataURI.split(',').slice(1).join(',')));
              title = meta.name || title;
              description = meta.description || description;
              category = meta.category || category;
            } catch {}
          } else if (data.metadataURI.startsWith('https://') || data.metadataURI.startsWith('ipfs://')) {
            try {
              const url = data.metadataURI.startsWith('ipfs://')
                ? `https://ipfs.io/ipfs/${data.metadataURI.slice(7)}`
                : data.metadataURI;
              const response = await fetch(url);
              if (response.ok) {
                const meta = await response.json();
                title = meta.name || title;
                description = meta.description || description;
                category = meta.category || category;
              }
            } catch {}
          }
          return {
            id,
            creator: data.creator,
            deadline: data.deadline,
            goal: data.goal,
            raised: data.raised,
            claimed: data.claimed,
            metadataURI: data.metadataURI,
            title,
            description,
            category,
            contribution,
          };
        })
      );
      setCampaigns(next.reverse());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load campaigns from the selected network.');
    } finally {
      setLoading(false);
    }
  }, [client, address]);

  useEffect(() => {
    if (!configured) return;
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(timer);
  }, [configured, refresh]);

  useEffect(() => {
    if (isSuccess && hash && handledReceiptRef.current !== hash) {
      handledReceiptRef.current = hash;
      const timer = setTimeout(() => {
        setNotice('Transaction confirmed on Sepolia.');
        void refresh();
        setSelected(null);
        setCreating(false);
        setAmount('');
        reset();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, hash, refresh, reset]);

  const filteredPreview = useMemo(
    () =>
      preview.filter(
        c =>
          (filter === 'For you' || filter === 'All projects' || c.category.toLowerCase().includes(filter.toLowerCase())) &&
          c.title.toLowerCase().includes(query.toLowerCase())
      ),
    [filter, query]
  );

  const filtered = useMemo(
    () =>
      campaigns.filter(
        c =>
          (filter === 'For you' || filter === 'All projects' || c.category.toLowerCase().includes(filter.toLowerCase())) &&
          c.title.toLowerCase().includes(query.toLowerCase())
      ),
    [campaigns, filter, query]
  );

  const isOpen = (c: Campaign) => currentTime < c.deadline;

  const tx = (action: 'contribute' | 'withdraw' | 'refund', c: Campaign, value?: bigint) => {
    if (!contractAddress || !isAddress(contractAddress)) return;
    setNotice('');
    if (action === 'contribute' && value !== undefined) {
      writeContract({
        address: contractAddress,
        abi: openFundAbi,
        functionName: 'contribute',
        args: [c.id],
        value,
        chainId: sepolia.id,
      });
    }
    if (action === 'withdraw') {
      writeContract({
        address: contractAddress,
        abi: openFundAbi,
        functionName: 'withdraw',
        args: [c.id],
        chainId: sepolia.id,
      });
    }
    if (action === 'refund') {
      writeContract({
        address: contractAddress,
        abi: openFundAbi,
        functionName: 'refund',
        args: [c.id],
        chainId: sepolia.id,
      });
    }
  };

  const create = () => {
    if (!contractAddress || !goal || !metadataURI) return;
    if (!isAddress(contractAddress)) {
      setNotice('Set a valid contract address in NEXT_PUBLIC_CAMPAIGN_FACTORY_ADDRESS.');
      return;
    }
    let wei: bigint;
    try {
      wei = parseEther(goal);
    } catch {
      setNotice('Enter a valid ETH goal.');
      return;
    }
    if (!metadataURI.startsWith('https://') && !metadataURI.startsWith('ipfs://')) {
      setNotice('Use an https:// or ipfs:// JSON metadata URL.');
      return;
    }
    if (metadataURI.length > 200) {
      setNotice('Metadata URL must be 200 characters or fewer.');
      return;
    }
    writeContract({
      address: contractAddress,
      abi: openFundAbi,
      functionName: 'createCampaign',
      args: [wei, BigInt(duration) * 86400n, metadataURI],
      chainId: sepolia.id,
    });
  };

  const pending = isPending || confirming;

  return (
    <>
      <div className="filters">
        <div className="filter-tabs">
          {filters.map(x => (
            <button key={x} className={filter === x ? 'selected' : ''} onClick={() => setFilter(x)}>
              {x}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={15} />
          <input placeholder="Search projects" value={query} onChange={e => setQuery(e.target.value)} />
        </label>
      </div>

      {configured && (
        <div className="chain-status">
          <span className="stat-dot" /> {isSepolia ? 'LIVE ON SEPOLIA' : 'SWITCH WALLET TO SEPOLIA'}{' '}
          {isSepolia && <button onClick={() => void refresh()}>Refresh</button>}
          <button className="create-inline" onClick={() => setCreating(true)}>
            <Plus size={14} /> Create campaign
          </button>
        </div>
      )}

      {!configured && (
        <div className="preview-banner">
          Preview mode · Add a deployed contract address to enable live campaigns and on-chain actions.
        </div>
      )}

      {(writeError || loadError || notice) && (
        <div className={'notice ' + (writeError || loadError ? 'error' : '')}>
          {writeError?.message || loadError || notice}
        </div>
      )}

      {configured && loading ? (
        <div className="empty-state">
          <LoaderCircle className="spin" /> Loading campaigns from Sepolia…
        </div>
      ) : null}

      {configured && !loading && filtered.length === 0 ? (
        <div className="empty-state">No campaigns found yet. Be the first to create one.</div>
      ) : null}

      <div className="cards" id="projects">
        {!configured &&
          filteredPreview.map(p => {
            const percent = Math.min(100, Math.round((Number(p.raised) / Number(p.goal)) * 100));
            return (
              <article className="card" key={p.title}>
                <div className={'cover ' + p.color}>
                  <span className="cover-tag">{p.tag}</span>
                  <button
                    className={'save ' + (saved.includes(p.title) ? 'saved' : '')}
                    onClick={() => setSaved(saved.includes(p.title) ? saved.filter(s => s !== p.title) : [...saved, p.title])}
                    aria-label="Save project"
                  >
                    <Bookmark size={16} />
                  </button>
                  <span className="cover-emoji">{p.mark}</span>
                  <span className="cover-swoosh" />
                </div>
                <div className="card-body">
                  <div className="category">
                    {p.category}
                    <span> · </span>
                    {p.days} DAYS LEFT
                  </div>
                  <h3>{p.title}</h3>
                  <p className="desc">{p.desc}</p>
                  <div className="creator">
                    <span className="avatar">{p.by.charAt(0)}</span>
                    <span>
                      by <b>{p.by}</b>
                    </span>
                    <ShieldCheck size={14} className="verified" />
                  </div>
                  <div className="progress">
                    <span style={{ width: `${percent}%` }} />
                  </div>
                  <div className="funding">
                    <strong>
                      Ξ {p.raised} <span>raised</span>
                    </strong>
                    <span>
                      {percent}% of Ξ {p.goal}
                    </span>
                  </div>
                  <div className="card-foot">
                    <span>
                      <WalletCards size={14} />
                      {p.backers} backers
                    </span>
                    <span className="sample-label">SAMPLE</span>
                  </div>
                </div>
              </article>
            );
          })}

        {configured &&
          filtered.map(c => {
            const percent = Number(c.goal) ? Math.min(100, Number((c.raised * 100n) / c.goal)) : 0;
            const open = isOpen(c);
            const success = !open && c.raised >= c.goal;
            const owner = address?.toLowerCase() === c.creator.toLowerCase();
            const secondsLeft = c.deadline > currentTime ? c.deadline - currentTime : 0n;
            const daysLeft = Math.ceil(Number(secondsLeft) / 86400);

            return (
              <article className="card" key={String(c.id)}>
                <div className="cover onchain-cover">
                  <span className="cover-tag">{success ? 'SUCCESSFUL' : open ? 'FUNDING OPEN' : 'FUNDING CLOSED'}</span>
                  <span className="cover-emoji">🌱</span>
                  <span className="cover-swoosh" />
                </div>
                <div className="card-body">
                  <div className="category">
                    CAMPAIGN #{String(c.id)}
                    <span> · </span>
                    {open ? `${daysLeft} DAYS LEFT` : 'ENDED'}
                  </div>
                  <h3>{c.title}</h3>
                  <p className="desc">{c.description}</p>
                  <div className="creator">
                    <span className="avatar">{c.creator.slice(2, 4).toUpperCase()}</span>
                    <span>
                      by <b>{c.creator.slice(0, 6)}…{c.creator.slice(-4)}</b>
                    </span>
                    <ShieldCheck size={14} className="verified" />
                  </div>
                  <div className="progress">
                    <span style={{ width: `${percent}%` }} />
                  </div>
                  <div className="funding">
                    <strong>
                      Ξ {Number(formatEther(c.raised)).toFixed(3)} <span>raised</span>
                    </strong>
                    <span>
                      {percent}% of Ξ {Number(formatEther(c.goal)).toFixed(2)}
                    </span>
                  </div>
                  <div className="card-foot">
                    <span>
                      <Clock3 size={14} />
                      {open ? 'Accepting contributions' : success ? 'Goal reached' : 'Goal missed'}
                    </span>
                    {isConnected && isSepolia && open && (
                      <button disabled={pending} onClick={() => setSelected(c)}>
                        Contribute
                      </button>
                    )}
                    {isConnected && isSepolia && owner && success && !c.claimed && (
                      <button disabled={pending} onClick={() => void tx('withdraw', c)}>
                        Withdraw
                      </button>
                    )}
                    {isConnected && isSepolia && !open && !success && c.contribution > 0n && (
                      <button disabled={pending} onClick={() => void tx('refund', c)}>
                        Claim refund · Ξ {Number(formatEther(c.contribution)).toFixed(3)}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
      </div>

      {(creating || selected) && (
        <div
          className="modal-backdrop"
          onMouseDown={e => {
            if (e.target === e.currentTarget) {
              setCreating(false);
              setSelected(null);
            }
          }}
        >
          <div className="modal">
            <button
              className="modal-close"
              onClick={() => {
                setCreating(false);
                setSelected(null);
              }}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <div className="eyebrow dark">{creating ? 'START SOMETHING GOOD' : 'BACK THIS CAMPAIGN'}</div>
            <h3>{creating ? 'Create a campaign' : selected?.title}</h3>
            <p>
              {creating
                ? 'Launch a transparent, all-or-nothing fundraiser on Ethereum.'
                : 'Your contribution is held by the campaign contract until its deadline.'}
            </p>
            {creating ? (
              <>
                <label>
                  Funding goal (ETH)
                  <input
                    value={goal}
                    onChange={e => setGoal(e.target.value)}
                    placeholder="e.g. 2.5"
                    inputMode="decimal"
                  />
                </label>
                <label>
                  Campaign duration
                  <select value={duration} onChange={e => setDuration(e.target.value)}>
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                    <option value="30">30 days</option>
                    <option value="60">60 days</option>
                    <option value="90">90 days</option>
                  </select>
                </label>
                <label>
                  Metadata JSON URL
                  <input
                    value={metadataURI}
                    onChange={e => setMetadataURI(e.target.value)}
                    placeholder="ipfs://… or https://…"
                  />
                  <small>Host a JSON file with name and description; IPFS URLs are supported.</small>
                </label>
                <button
                  className="button primary modal-submit"
                  disabled={pending || !isConnected || !isSepolia}
                  onClick={create}
                >
                  {pending ? (
                    <>
                      <LoaderCircle className="spin" size={15} /> Confirming…
                    </>
                  ) : !isConnected ? (
                    'Connect wallet to continue'
                  ) : !isSepolia ? (
                    'Switch wallet to Sepolia'
                  ) : (
                    'Create on Sepolia'
                  )}
                </button>
              </>
            ) : (
              <>
                <label>
                  Contribution amount (ETH)
                  <input
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.05"
                    inputMode="decimal"
                  />
                </label>
                <button
                  className="button primary modal-submit"
                  disabled={pending || !isConnected || !isSepolia || !amount}
                  onClick={() => {
                    if (selected && amount) {
                      try {
                        void tx('contribute', selected, parseEther(amount));
                      } catch {
                        setNotice('Enter a valid ETH amount.');
                      }
                    }
                  }}
                >
                  {pending ? (
                    <>
                      <LoaderCircle className="spin" size={15} /> Confirming…
                    </>
                  ) : !isConnected ? (
                    'Connect wallet to continue'
                  ) : !isSepolia ? (
                    'Switch wallet to Sepolia'
                  ) : (
                    'Contribute with wallet'
                  )}
                </button>
              </>
            )}
            {hash && (
              <div className="tx-hash">
                <CircleCheck size={14} />
                {confirming ? 'Transaction submitted; waiting for block confirmation.' : 'View transaction'}{' '}
                <a href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noreferrer">
                  Etherscan <ArrowUpRight size={12} />
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
