require('dotenv').config();
const mongoose = require('mongoose');
const Trend = require('./src/models/Trend');

const trendsToSeed = [
    {
        trendId: "trend_ai_coding_agents",
        title: "Google AI Coding Agents Take Center Stage",
        category: "AI",
        time: "1h ago",
        readTime: "4 min read",
        author: "Tech Insider",
        growth: "+240%",
        image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=600",
        content: "Google's new agentic AI frameworks are changing the software development landscape, allowing developers to automate complex engineering workflows instantly.",
        sourceUrl: "https://blog.google/technology/ai/agentic-frameworks",
        engagementScore: 94,
        type: "news",
        publishedAt: new Date(Date.now() - 3600000 * 1),
        trendScore: 95,
        location: "Global",
        isEmerging: true,
        emergingDetectedAt: new Date(),
        scoring: { viralScore: 94, heatScore: 96, growthScore: 95, compositeScore: 95 },
        scoreHistory: [
            { ts: new Date(Date.now() - 3600000 * 6), v: 60, h: 65, g: 70, c: 65 },
            { ts: new Date(Date.now() - 3600000 * 4), v: 75, h: 80, g: 82, c: 79 },
            { ts: new Date(Date.now() - 3600000 * 2), v: 88, h: 90, g: 92, c: 90 },
            { ts: new Date(), v: 94, h: 96, g: 95, c: 95 }
        ],
        aiConfidence: { score: 92, sourceConsistency: 90, dataCompleteness: 94, evaluatedAt: new Date() },
        analysis: {
            status: "completed",
            summary: "Google's agentic coding AI models show unprecedented automation capacity across full-stack repositories.",
            whyTrending: "Increased open-source contributions, framework launches, and massive corporate adoption drive agentic AI interest to record peaks.",
            sentiment: "positive",
            sentimentScore: 92,
            targetAudience: "Developers, Tech Leads, Founders",
            prediction: "Agentic software engineering will capture over 30% of standard dev tasks by Q4.",
            viralityScore: 94,
            growthMomentum: "viral",
            keywords: ["Agentic AI", "Antigravity", "Google AI", "Devin", "Coding Assistants"],
            processedAt: new Date()
        },
        predictions: {
            lifecycleState: "viral",
            confidenceScore: 0.94,
            predictedRegions: [
                { country: "United States", probability: 0.95, timeLagHours: 1 },
                { country: "India", probability: 0.90, timeLagHours: 2 },
                { country: "United Kingdom", probability: 0.85, timeLagHours: 3 }
            ]
        }
    },
    {
        trendId: "trend_cricket_ipl_stars",
        title: "Rising Cricket Stars Dominate IPL Auction Talk",
        category: "Cricket",
        time: "3h ago",
        readTime: "5 min read",
        author: "CricInfo Daily",
        growth: "+180%",
        image: "https://images.unsplash.com/photo-1531415080290-bc9b8998063a?auto=format&fit=crop&q=80&w=600",
        content: "Emerging domestic talent sweeps major headlines as IPL franchises finalize their high-stakes scouting and player selection strategies.",
        sourceUrl: "https://www.espncricinfo.com/ipl-news-scouting",
        engagementScore: 88,
        type: "reddit",
        publishedAt: new Date(Date.now() - 3600000 * 3),
        trendScore: 89,
        location: "India",
        isEmerging: true,
        emergingDetectedAt: new Date(),
        scoring: { viralScore: 88, heatScore: 90, growthScore: 89, compositeScore: 89 },
        scoreHistory: [
            { ts: new Date(Date.now() - 3600000 * 8), v: 50, h: 52, g: 55, c: 52 },
            { ts: new Date(Date.now() - 3600000 * 6), v: 65, h: 70, g: 72, c: 69 },
            { ts: new Date(Date.now() - 3600000 * 3), v: 88, h: 90, g: 89, c: 89 }
        ],
        aiConfidence: { score: 89, sourceConsistency: 85, dataCompleteness: 92, evaluatedAt: new Date() },
        analysis: {
            status: "completed",
            summary: "Domestic scouting networks are disrupting traditional IPL bidding tactics with data-driven recruitment.",
            whyTrending: "A series of record-breaking domestic matches combined with early pre-auction negotiations has created extreme fan debate.",
            sentiment: "positive",
            sentimentScore: 85,
            targetAudience: "Cricket Fans, Sports Analysts, Franchise Owners",
            prediction: "Uncapped players will command record-breaking valuations in the upcoming auction cycle.",
            viralityScore: 90,
            growthMomentum: "accelerating",
            keywords: ["IPL Auction", "Cricket India", "Domestic Scouting", "Emerging Players"],
            processedAt: new Date()
        },
        predictions: {
            lifecycleState: "accelerating",
            confidenceScore: 0.89,
            predictedRegions: [
                { country: "India", probability: 0.98, timeLagHours: 0 },
                { country: "Australia", probability: 0.75, timeLagHours: 4 }
            ]
        }
    },
    {
        trendId: "trend_apple_ar_glasses",
        title: "Apple Next-Gen AR Glasses Leak with Neural Controls",
        category: "Gadgets",
        time: "5h ago",
        readTime: "6 min read",
        author: "Gizmodo Tech",
        growth: "+150%",
        image: "https://images.unsplash.com/photo-1593508512255-86ab42a8e620?auto=format&fit=crop&q=80&w=600",
        content: "New supply chain leaks point to lightweight Apple smart glasses equipped with direct spatial neural bands for dynamic interaction.",
        sourceUrl: "https://gizmodo.com/apple-ar-neural-leak",
        engagementScore: 82,
        type: "news",
        publishedAt: new Date(Date.now() - 3600000 * 5),
        trendScore: 84,
        location: "Global",
        isEmerging: true,
        emergingDetectedAt: new Date(),
        scoring: { viralScore: 82, heatScore: 86, growthScore: 84, compositeScore: 84 },
        scoreHistory: [
            { ts: new Date(Date.now() - 3600000 * 12), v: 40, h: 42, g: 45, c: 42 },
            { ts: new Date(Date.now() - 3600000 * 5), v: 82, h: 86, g: 84, c: 84 }
        ],
        aiConfidence: { score: 85, sourceConsistency: 82, dataCompleteness: 88, evaluatedAt: new Date() },
        analysis: {
            status: "completed",
            summary: "Neural interfaces are taking center stage as AR hardware moves past heavy hand gestures.",
            whyTrending: "Leaked schematics from prominent hardware aggregators triggered discussions across multiple tech subreddits.",
            sentiment: "neutral",
            sentimentScore: 70,
            targetAudience: "Gadget Lovers, AR/VR Developers, Hardware Engineers",
            prediction: "A commercial developer kit will be revealed at the upcoming fall hardware conference.",
            viralityScore: 86,
            growthMomentum: "emerging",
            keywords: ["AR Glasses", "Apple Smart Glasses", "Spatial Computing", "Neural Interface"],
            processedAt: new Date()
        },
        predictions: {
            lifecycleState: "emerging",
            confidenceScore: 0.85,
            predictedRegions: [
                { country: "United States", probability: 0.90, timeLagHours: 1 },
                { country: "Japan", probability: 0.80, timeLagHours: 3 }
            ]
        }
    },
    {
        trendId: "trend_green_hydrogen_in",
        title: "India Sets New Benchmarks in Green Hydrogen Projects",
        category: "Clean Energy",
        time: "8h ago",
        readTime: "5 min read",
        author: "Mint Business",
        growth: "+120%",
        image: "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&q=80&w=600",
        content: "New clean energy parks across western India spark record levels of green energy investment, advancing global net-zero goals.",
        sourceUrl: "https://livemint.com/green-hydrogen-benchmarks",
        engagementScore: 78,
        type: "news",
        publishedAt: new Date(Date.now() - 3600000 * 8),
        trendScore: 80,
        location: "India",
        isEmerging: true,
        emergingDetectedAt: new Date(),
        scoring: { viralScore: 78, heatScore: 82, growthScore: 80, compositeScore: 80 },
        scoreHistory: [
            { ts: new Date(Date.now() - 3600000 * 24), v: 30, h: 32, g: 35, c: 32 },
            { ts: new Date(Date.now() - 3600000 * 8), v: 78, h: 82, g: 80, c: 80 }
        ],
        aiConfidence: { score: 90, sourceConsistency: 92, dataCompleteness: 88, evaluatedAt: new Date() },
        analysis: {
            status: "completed",
            summary: "Massive state subsidies are successfully driving domestic chemical giants to convert infrastructure to clean hydrogen.",
            whyTrending: "Government budget releases allocating clean subsidies sparked high trade volumes on local energy shares.",
            sentiment: "positive",
            sentimentScore: 90,
            targetAudience: "Energy Investors, ESG Consultants, Chemical Engineers",
            prediction: "Industrial carbon emissions in selected zones will fall by 18% over the next 18 months.",
            viralityScore: 78,
            growthMomentum: "accelerating",
            keywords: ["Green Hydrogen", "Clean Energy", "India Net Zero", "Energy Stocks"],
            processedAt: new Date()
        },
        predictions: {
            lifecycleState: "accelerating",
            confidenceScore: 0.90,
            predictedRegions: [
                { country: "India", probability: 0.98, timeLagHours: 0 },
                { country: "Germany", probability: 0.85, timeLagHours: 5 }
            ]
        }
    },
    {
        trendId: "trend_gta_6_leak",
        title: "GTA 6 Release Leaks Hint at Dynamic Weather Mechanics",
        category: "Gaming",
        time: "12h ago",
        readTime: "4 min read",
        author: "IGN News",
        growth: "+310%",
        image: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80&w=600",
        content: "New developer server leaks suggest a hyper-realistic weather engine with real-world synchronized hurricane sequences.",
        sourceUrl: "https://www.ign.com/gta-6-weather-engine-leak",
        engagementScore: 96,
        type: "reddit",
        publishedAt: new Date(Date.now() - 3600000 * 12),
        trendScore: 94,
        location: "Global",
        isEmerging: true,
        emergingDetectedAt: new Date(),
        scoring: { viralScore: 96, heatScore: 92, growthScore: 94, compositeScore: 94 },
        scoreHistory: [
            { ts: new Date(Date.now() - 3600000 * 24), v: 45, h: 48, g: 50, c: 48 },
            { ts: new Date(Date.now() - 3600000 * 12), v: 96, h: 92, g: 94, c: 94 }
        ],
        aiConfidence: { score: 82, sourceConsistency: 78, dataCompleteness: 86, evaluatedAt: new Date() },
        analysis: {
            status: "completed",
            summary: "Leaks detail complex server calculations designed to render dynamic environmental shifts on modern console setups.",
            whyTrending: "A series of viral TikTok and Reddit clips showcasing high-fidelity atmospheric changes created immediate massive fan hype.",
            sentiment: "positive",
            sentimentScore: 82,
            targetAudience: "Gamers, Graphics Developers, Console Enthusiasts",
            prediction: "An official graphics trailer focusing on environmental mechanics will drop in early July.",
            viralityScore: 96,
            growthMomentum: "viral",
            keywords: ["GTA 6", "Rockstar Leaks", "Graphics Engine", "Next Gen Gaming"],
            processedAt: new Date()
        },
        predictions: {
            lifecycleState: "viral",
            confidenceScore: 0.82,
            predictedRegions: [
                { country: "United States", probability: 0.95, timeLagHours: 1 },
                { country: "India", probability: 0.88, timeLagHours: 2 }
            ]
        }
    },
    {
        trendId: "trend_sc_ruling_finance",
        title: "Supreme Court Rulings Impact Fintech Lending Rules",
        category: "Finance",
        time: "15h ago",
        readTime: "7 min read",
        author: "Economic Times",
        growth: "+140%",
        image: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&q=80&w=600",
        content: "New structural mandates restrict short-term interest rates and prompt fintech institutions to rebuild automated screening tools.",
        sourceUrl: "https://economictimes.indiatimes.com/fintech-lending-rules",
        engagementScore: 72,
        type: "news",
        publishedAt: new Date(Date.now() - 3600000 * 15),
        trendScore: 75,
        location: "India",
        isEmerging: true,
        emergingDetectedAt: new Date(),
        scoring: { viralScore: 72, heatScore: 78, growthScore: 75, compositeScore: 75 },
        scoreHistory: [
            { ts: new Date(Date.now() - 3600000 * 30), v: 25, h: 30, g: 32, c: 29 },
            { ts: new Date(Date.now() - 3600000 * 15), v: 72, h: 78, g: 75, c: 75 }
        ],
        aiConfidence: { score: 94, sourceConsistency: 96, dataCompleteness: 92, evaluatedAt: new Date() },
        analysis: {
            status: "completed",
            summary: "Lending institutions are adjusting compliance strategies to navigate the clean legal definitions laid out by the Supreme Court.",
            whyTrending: "Financial analysts and tech reporters are extensively analyzing compliance guidelines on LinkedIn and trade news blogs.",
            sentiment: "negative",
            sentimentScore: 28,
            targetAudience: "Fintech Founders, Risk Analysts, Compliance Officers",
            prediction: "Fintech startups will transition heavily to collateral-backed lending solutions within 3 months.",
            viralityScore: 70,
            growthMomentum: "accelerating",
            keywords: ["Fintech India", "Supreme Court Ruling", "Digital Lending", "RBI Rules"],
            processedAt: new Date()
        },
        predictions: {
            lifecycleState: "accelerating",
            confidenceScore: 0.94,
            predictedRegions: [
                { country: "India", probability: 0.99, timeLagHours: 0 }
            ]
        }
    },
    {
        trendId: "trend_cyber_defense_ai",
        title: "AI Cybersecurity Tools Halt Global Ransomware Wave",
        category: "Cybersecurity",
        time: "18h ago",
        readTime: "5 min read",
        author: "Wired Tech",
        growth: "+220%",
        image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=600",
        content: "Autonomous cyberdefense models successfully detect, contain, and disarm sophisticated zero-day malware attacks across vital server clusters.",
        sourceUrl: "https://wired.com/ai-cybersecurity-ransomware",
        engagementScore: 85,
        type: "news",
        publishedAt: new Date(Date.now() - 3600000 * 18),
        trendScore: 86,
        location: "Global",
        isEmerging: true,
        emergingDetectedAt: new Date(),
        scoring: { viralScore: 85, heatScore: 87, growthScore: 86, compositeScore: 86 },
        scoreHistory: [
            { ts: new Date(Date.now() - 3600000 * 36), v: 35, h: 40, g: 42, c: 39 },
            { ts: new Date(Date.now() - 3600000 * 18), v: 85, h: 87, g: 86, c: 86 }
        ],
        aiConfidence: { score: 91, sourceConsistency: 89, dataCompleteness: 93, evaluatedAt: new Date() },
        analysis: {
            status: "completed",
            summary: "Next-gen threat intelligence platforms are utilizing low-latency neural nets to catch zero-day payloads.",
            whyTrending: "A major logistics hub credited their clean, instant recovery to automated system guardians, sparking high industry praise.",
            sentiment: "positive",
            sentimentScore: 94,
            targetAudience: "CISOs, Server Admins, Cloud Engineers",
            prediction: "Traditional pattern-based antivirus software will face complete irrelevancy as behavioral models sweep enterprise deals.",
            viralityScore: 85,
            growthMomentum: "viral",
            keywords: ["Ransomware Defended", "Autonomous Security", "Zero Day Malware", "Cloud Architecture"],
            processedAt: new Date()
        },
        predictions: {
            lifecycleState: "viral",
            confidenceScore: 0.91,
            predictedRegions: [
                { country: "United States", probability: 0.95, timeLagHours: 1 },
                { country: "Germany", probability: 0.88, timeLagHours: 2 }
            ]
        }
    },
    {
        trendId: "trend_bollywood_box_office",
        title: "Blockbuster Releases Break Post-Pandemic Box Office Records",
        category: "Movies",
        time: "1d ago",
        readTime: "6 min read",
        author: "Bollywood Hungama",
        growth: "+170%",
        image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&q=80&w=600",
        content: "Theater footfalls soar as dual high-budget releases captivate mass single screens and premium multiplexes across the subcontinent.",
        sourceUrl: "https://www.bollywoodhungama.com/box-office-blockbuster",
        engagementScore: 79,
        type: "news",
        publishedAt: new Date(Date.now() - 86400000),
        trendScore: 81,
        location: "India",
        isEmerging: true,
        emergingDetectedAt: new Date(),
        scoring: { viralScore: 79, heatScore: 83, growthScore: 81, compositeScore: 81 },
        scoreHistory: [
            { ts: new Date(Date.now() - 86400000 * 2), v: 40, h: 42, g: 45, c: 42 },
            { ts: new Date(Date.now() - 86400000), v: 79, h: 83, g: 81, c: 81 }
        ],
        aiConfidence: { score: 88, sourceConsistency: 85, dataCompleteness: 91, evaluatedAt: new Date() },
        analysis: {
            status: "completed",
            summary: "Subnational action thrillers are demonstrating incredible financial durability compared to traditional romantic dramas.",
            whyTrending: "Extreme ticket booking volumes triggered website outages on leading aggregator apps.",
            sentiment: "positive",
            sentimentScore: 88,
            targetAudience: "Cinema Lovers, Movie Distributors, Trade Analysts",
            prediction: "This week's release is set to cross the 500-crore threshold in record speed.",
            viralityScore: 80,
            growthMomentum: "accelerating",
            keywords: ["Bollywood Box Office", "Multiplex Records", "South Action Movies", "Theatre Bookings"],
            processedAt: new Date()
        },
        predictions: {
            lifecycleState: "accelerating",
            confidenceScore: 0.88,
            predictedRegions: [
                { country: "India", probability: 0.99, timeLagHours: 0 }
            ]
        }
    },
    {
        trendId: "trend_rust_webdev",
        title: "Developer Surveys Report Strong Shift to Rust Web Services",
        category: "Developer Ecosystem",
        time: "1d ago",
        readTime: "8 min read",
        author: "DevNews Weekly",
        growth: "+130%",
        image: "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?auto=format&fit=crop&q=80&w=600",
        content: "New system surveys demonstrate massive jumps in backend developer satisfaction and database server cost reductions after rewriting platforms in Rust.",
        sourceUrl: "https://devnews.weekly.com/rust-webdev-transition",
        engagementScore: 75,
        type: "reddit",
        publishedAt: new Date(Date.now() - 86400000),
        trendScore: 78,
        location: "Global",
        isEmerging: true,
        emergingDetectedAt: new Date(),
        scoring: { viralScore: 75, heatScore: 81, growthScore: 78, compositeScore: 78 },
        scoreHistory: [
            { ts: new Date(Date.now() - 86400000 * 3), v: 30, h: 35, g: 38, c: 34 },
            { ts: new Date(Date.now() - 86400000), v: 75, h: 81, g: 78, c: 78 }
        ],
        aiConfidence: { score: 92, sourceConsistency: 94, dataCompleteness: 90, evaluatedAt: new Date() },
        analysis: {
            status: "completed",
            summary: "Memory safety and minimal runtime footprint are successfully driving large-scale migrations from Node/Python backend systems to Rust.",
            whyTrending: "Multiple system post-mortems highlighting massive cost savings hit the front page of HackerNews.",
            sentiment: "positive",
            sentimentScore: 90,
            targetAudience: "Backend Developers, System Architects, DevOps Leads",
            prediction: "Rust-based server frameworks will surpass Go in developer-mindshare metrics by mid next year.",
            viralityScore: 75,
            growthMomentum: "accelerating",
            keywords: ["Rust Backend", "Memory Safety", "Server Costs", "Axum Web Framework"],
            processedAt: new Date()
        },
        predictions: {
            lifecycleState: "accelerating",
            confidenceScore: 0.92,
            predictedRegions: [
                { country: "United States", probability: 0.92, timeLagHours: 1 },
                { country: "Germany", probability: 0.85, timeLagHours: 2 }
            ]
        }
    },
    {
        trendId: "trend_solana_scaling",
        title: "Solana Finalizes Liquid Staking Framework Upgrades",
        category: "Blockchain",
        time: "1d ago",
        readTime: "5 min read",
        author: "Coindesk Ledger",
        growth: "+190%",
        image: "https://images.unsplash.com/photo-1621761191319-c6fb62004040?auto=format&fit=crop&q=80&w=600",
        content: "Decentralized networks deploy advanced validation pipelines, reducing transaction fees during heavy trading spikes to zero.",
        sourceUrl: "https://www.coindesk.com/solana-staking-upgrades",
        engagementScore: 84,
        type: "news",
        publishedAt: new Date(Date.now() - 86400000),
        trendScore: 85,
        location: "Global",
        isEmerging: true,
        emergingDetectedAt: new Date(),
        scoring: { viralScore: 84, heatScore: 86, growthScore: 85, compositeScore: 85 },
        scoreHistory: [
            { ts: new Date(Date.now() - 86400000 * 3), v: 45, h: 48, g: 50, c: 48 },
            { ts: new Date(Date.now() - 86400000), v: 84, h: 86, g: 85, c: 85 }
        ],
        aiConfidence: { score: 87, sourceConsistency: 84, dataCompleteness: 90, evaluatedAt: new Date() },
        analysis: {
            status: "completed",
            summary: "By isolating local execution fee markets, developer squads prevented general congestion from blocking retail swaps.",
            whyTrending: "A series of high-profile staking pools launched concurrent yield campaigns, drawing massive asset flows.",
            sentiment: "positive",
            sentimentScore: 88,
            targetAudience: "Defi Traders, Smart Contract Engineers, Crypto Analysts",
            prediction: "LST assets will comprise over 60% of total staked tokens within two quarters.",
            viralityScore: 84,
            growthMomentum: "viral",
            keywords: ["Solana Upgrade", "Liquid Staking", "DeFi Swaps", "Layer 1 Scaling"],
            processedAt: new Date()
        },
        predictions: {
            lifecycleState: "viral",
            confidenceScore: 0.87,
            predictedRegions: [
                { country: "United States", probability: 0.90, timeLagHours: 1 },
                { country: "South Korea", probability: 0.85, timeLagHours: 2 }
            ]
        }
    },
    {
        trendId: "trend_youtube_comedy_rise",
        title: "Indie Comedy Channels Sweep YouTube India Trending List",
        category: "YouTube Trending",
        time: "2d ago",
        readTime: "4 min read",
        author: "Tubefilter Asia",
        growth: "+160%",
        image: "https://images.unsplash.com/photo-1516280440614-37939bbacd6a?auto=format&fit=crop&q=80&w=600",
        content: "Raw standup specials and self-produced comedic skits capture millions of organic views, shifting dominance from large television studios.",
        sourceUrl: "https://www.tubefilter.com/youtube-india-indie-comedy",
        engagementScore: 77,
        type: "video",
        publishedAt: new Date(Date.now() - 86400000 * 2),
        trendScore: 79,
        location: "India",
        isEmerging: true,
        emergingDetectedAt: new Date(),
        scoring: { viralScore: 77, heatScore: 81, growthScore: 79, compositeScore: 79 },
        scoreHistory: [
            { ts: new Date(Date.now() - 86400000 * 4), v: 38, h: 40, g: 42, c: 40 },
            { ts: new Date(Date.now() - 86400000 * 2), v: 77, h: 81, g: 79, c: 79 }
        ],
        aiConfidence: { score: 91, sourceConsistency: 88, dataCompleteness: 94, evaluatedAt: new Date() },
        analysis: {
            status: "completed",
            summary: "Relatable sketches focusing on middle-class experiences are yielding much higher viewer retention than glossy corporate shows.",
            whyTrending: "A viral standup clip referencing domestic corporate work-life gained massive shares across WhatsApp groups.",
            sentiment: "positive",
            sentimentScore: 92,
            targetAudience: "Youth, Content Creators, Brand Marketers",
            prediction: "Indie comedy creators will command over 50% of direct brand collaboration budgets this festive season.",
            viralityScore: 79,
            growthMomentum: "accelerating",
            keywords: ["YouTube India", "Standup Comedy", "Viral Skits", "Indie Creators"],
            processedAt: new Date()
        },
        predictions: {
            lifecycleState: "accelerating",
            confidenceScore: 0.91,
            predictedRegions: [
                { country: "India", probability: 0.99, timeLagHours: 0 }
            ]
        }
    },
    {
        trendId: "trend_ai_hardware_silicon",
        title: "Startup Silicon Giants Challenge Enterprise GPU Monopoly",
        category: "Hardware",
        time: "2d ago",
        readTime: "5 min read",
        author: "TechCrunch",
        growth: "+145%",
        image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=600",
        content: "New neural processing units designed explicitly for low-power consumer endpoints capture key institutional venture funding.",
        sourceUrl: "https://techcrunch.com/silicon-startup-gpu-challenge",
        engagementScore: 76,
        type: "news",
        publishedAt: new Date(Date.now() - 86400000 * 2),
        trendScore: 77,
        location: "Global",
        isEmerging: true,
        emergingDetectedAt: new Date(),
        scoring: { viralScore: 76, heatScore: 78, growthScore: 77, compositeScore: 77 },
        scoreHistory: [
            { ts: new Date(Date.now() - 86400000 * 5), v: 30, h: 32, g: 35, c: 32 },
            { ts: new Date(Date.now() - 86400000 * 2), v: 76, h: 78, g: 77, c: 77 }
        ],
        aiConfidence: { score: 86, sourceConsistency: 83, dataCompleteness: 89, evaluatedAt: new Date() },
        analysis: {
            status: "completed",
            summary: "By bypassing traditional logic routing, startup silicon arrays are achieving 4x training efficiency gains.",
            whyTrending: "A series of positive benchmarking audits released by academic institutions validated performance claims.",
            sentiment: "positive",
            sentimentScore: 85,
            targetAudience: "Venture Capitalists, Hardware Architects, Model Optimizers",
            prediction: "Early enterprise beta clusters will begin live operations with commercial clients in Q1.",
            viralityScore: 78,
            growthMomentum: "emerging",
            keywords: ["NPU Architecture", "Silicon Startup", "GPU Shortage", "Model Training"],
            processedAt: new Date()
        },
        predictions: {
            lifecycleState: "emerging",
            confidenceScore: 0.86,
            predictedRegions: [
                { country: "United States", probability: 0.92, timeLagHours: 1 },
                { country: "South Korea", probability: 0.80, timeLagHours: 3 }
            ]
        }
    },
    {
        trendId: "trend_ai_sentiment_visuals",
        title: "Interactive AI Sentiment Visualizers Reshape App UX",
        category: "Technology",
        time: "3d ago",
        readTime: "6 min read",
        author: "Smashing Magazine",
        growth: "+175%",
        image: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?auto=format&fit=crop&q=80&w=600",
        content: "Dynamic CSS gradients and interactive canvas visualizers are replacing standard static dashboard metrics across major analytics suites.",
        sourceUrl: "https://www.smashingmagazine.com/ai-sentiment-visual-ux",
        engagementScore: 80,
        type: "news",
        publishedAt: new Date(Date.now() - 86400000 * 3),
        trendScore: 82,
        location: "Global",
        isEmerging: true,
        emergingDetectedAt: new Date(),
        scoring: { viralScore: 80, heatScore: 84, growthScore: 82, compositeScore: 82 },
        scoreHistory: [
            { ts: new Date(Date.now() - 86400000 * 6), v: 40, h: 45, g: 48, c: 44 },
            { ts: new Date(Date.now() - 86400000 * 3), v: 80, h: 84, g: 82, c: 82 }
        ],
        aiConfidence: { score: 93, sourceConsistency: 91, dataCompleteness: 95, evaluatedAt: new Date() },
        analysis: {
            status: "completed",
            summary: "Users report 35% higher session engagement when numbers are accompanied by beautiful, breathing visualizers.",
            whyTrending: "A series of gorgeous open-source React Native visualizer libraries gained immense popularity on GitHub.",
            sentiment: "positive",
            sentimentScore: 95,
            targetAudience: "UI/UX Designers, Mobile Developers, Product Managers",
            prediction: "Liquid visualizers will become a standard UI convention for high-end consumer apps by winter.",
            viralityScore: 82,
            growthMomentum: "accelerating",
            keywords: ["Fluid UX", "AI Visualizer", "React Native Anim", "Dynamic Gradients"],
            processedAt: new Date()
        },
        predictions: {
            lifecycleState: "accelerating",
            confidenceScore: 0.93,
            predictedRegions: [
                { country: "United States", probability: 0.94, timeLagHours: 1 },
                { country: "India", probability: 0.88, timeLagHours: 2 }
            ]
        }
    },
    {
        trendId: "trend_fintech_personal",
        title: "Hyper-Personalized Micro-Lending Sweeps Urban Hubs",
        category: "Finance",
        time: "3d ago",
        readTime: "5 min read",
        author: "LiveMint Clean",
        growth: "+135%",
        image: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&q=80&w=600",
        content: "Urban professionals adopt flexible micro-payment applications to smooth cash flow demands during mid-month gaps.",
        sourceUrl: "https://livemint.com/personal-lending-trends",
        engagementScore: 74,
        type: "news",
        publishedAt: new Date(Date.now() - 86400000 * 3),
        trendScore: 76,
        location: "India",
        isEmerging: true,
        emergingDetectedAt: new Date(),
        scoring: { viralScore: 74, heatScore: 78, growthScore: 76, compositeScore: 76 },
        scoreHistory: [
            { ts: new Date(Date.now() - 86400000 * 7), v: 30, h: 32, g: 35, c: 32 },
            { ts: new Date(Date.now() - 86400000 * 3), v: 74, h: 78, g: 76, c: 76 }
        ],
        aiConfidence: { score: 92, sourceConsistency: 94, dataCompleteness: 90, evaluatedAt: new Date() },
        analysis: {
            status: "completed",
            summary: "AI underwriting models successfully process utility data to extend low-risk small loans instantly.",
            whyTrending: "Industry trade reports highlighted zero default rates in newly launched personal finance programs.",
            sentiment: "positive",
            sentimentScore: 84,
            targetAudience: "Salaried Workers, Retail Bankers, Fintech Advisors",
            prediction: "Urban penetration will hit 40% of standard wage earners within one year.",
            viralityScore: 74,
            growthMomentum: "emerging",
            keywords: ["Micro Lending", "Fintech India", "AI Underwriting", "Salary Advance"],
            processedAt: new Date()
        },
        predictions: {
            lifecycleState: "emerging",
            confidenceScore: 0.92,
            predictedRegions: [
                { country: "India", probability: 0.99, timeLagHours: 0 }
            ]
        }
    },
    {
        trendId: "trend_climate_resilience",
        title: "Subnational Climate Action Coalitions Gain Momentum",
        category: "Environment",
        time: "4d ago",
        readTime: "7 min read",
        author: "Climate Pulse",
        growth: "+115%",
        image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=600",
        content: "Regional local bodies draft combined cooling and flood prevention blueprints, bypassing standard slow federal bureaucracy.",
        sourceUrl: "https://climatepulse.org/subnational-resilience",
        engagementScore: 70,
        type: "news",
        publishedAt: new Date(Date.now() - 86400000 * 4),
        trendScore: 72,
        location: "Global",
        isEmerging: true,
        emergingDetectedAt: new Date(),
        scoring: { viralScore: 70, heatScore: 74, growthScore: 72, compositeScore: 72 },
        scoreHistory: [
            { ts: new Date(Date.now() - 86400000 * 8), v: 30, h: 32, g: 35, c: 32 },
            { ts: new Date(Date.now() - 86400000 * 4), v: 70, h: 74, g: 72, c: 72 }
        ],
        aiConfidence: { score: 95, sourceConsistency: 96, dataCompleteness: 94, evaluatedAt: new Date() },
        analysis: {
            status: "completed",
            summary: "By deploying immediate local budgets, states are successfully creating immediate heat refuges and rain bioswales.",
            whyTrending: "A series of highly successful city-level cooling campaigns drew global policy-maker praise.",
            sentiment: "positive",
            sentimentScore: 92,
            targetAudience: "Urban Planners, Climate Advocates, Municipal Leaders",
            prediction: "Subnational alliances will capture over 40% of active green mitigation funds.",
            viralityScore: 72,
            growthMomentum: "accelerating",
            keywords: ["Urban Heat Refuges", "Bioswales", "Local Government", "Green Funds"],
            processedAt: new Date()
        },
        predictions: {
            lifecycleState: "accelerating",
            confidenceScore: 0.95,
            predictedRegions: [
                { country: "United States", probability: 0.92, timeLagHours: 1 },
                { country: "India", probability: 0.85, timeLagHours: 2 }
            ]
        }
    }
];

mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log("Connected to MongoDB!");
    
    // Clear old mock trends
    await Trend.deleteMany({});
    console.log("Cleared all existing trends.");
    
    // Insert new high-quality, pre-enriched, beautiful trends
    const inserted = await Trend.insertMany(trendsToSeed);
    console.log(`Successfully seeded ${inserted.length} premium, highly realistic trends!`);
    
    process.exit(0);
}).catch(err => {
    console.error("Seeding error:", err);
    process.exit(1);
});
