const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Trend = require('../models/Trend');

// Load env vars
dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const TRENDS_DATA = [
  {
    trendId: '1',
    title: 'Generative Video: The Next AI Frontier',
    category: 'AI Tech',
    time: '2 hours ago',
    readTime: '5 min read',
    author: 'TrendPulse AI',
    growth: '+450%',
    trendScore: 98,
    location: 'Global',
    image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1000',
    content: 'Generative video is transforming how content is created. AI models can now produce high-quality video from simple text prompts, enabling creators to build entire productions without cameras.\n\nOpenAI\'s Sora, Google\'s Lumiere, and Meta\'s Make-A-Video are leading this wave, with adoption rates surging 450% in Q1 2025 alone.\n\nExperts predict that by 2026, over 40% of social media content will be AI-generated, reshaping the creator economy entirely.',
    graph: {
        chartData: [{ month: 'Jan', value: 30 }, { month: 'Feb', value: 45 }, { month: 'Mar', value: 40 }, { month: 'Apr', value: 75 }, { month: 'May', value: 65 }, { month: 'Jun', value: 100 }],
        metrics: { peakVolume: '124.5k', dailyEngagers: '18.2k', topRegion: 'North Am.', shareRate: '14.8%' }
    }
  },
  {
    trendId: '2',
    title: 'Sustainable Logistics: Green Supply Chains',
    category: 'Environment',
    time: '4 hours ago',
    readTime: '4 min read',
    author: 'EcoTrend AI',
    growth: '+280%',
    trendScore: 85,
    location: 'Europe',
    image: 'https://images.unsplash.com/photo-1569426489641-24e6e0bbf840?auto=format&fit=crop&q=80&w=1000',
    sourceUrl: 'https://www.supplychaindive.com/news/amazon-pledges-50-net-zero-carbon-shipments-by-2030/548674/',
    content: 'Companies are racing to decarbonize their supply chains. Electric fleets, drone deliveries, and AI-optimized routing are reducing logistics emissions by up to 60%.\n\nMajor players like Amazon, DHL, and FedEx have committed to net-zero logistics by 2030, spurring a $280B green logistics market.\n\nStartups in this space raised over $4B in 2024, with investors betting big on the transition.',
    graph: {
        chartData: [{ month: 'Jan', value: 20 }, { month: 'Feb', value: 30 }, { month: 'Mar', value: 50 }, { month: 'Apr', value: 45 }, { month: 'May', value: 60 }, { month: 'Jun', value: 85 }],
        metrics: { peakVolume: '95k', dailyEngagers: '12.5k', topRegion: 'Europe', shareRate: '12.1%' }
    }
  },
  {
    trendId: '3',
    title: 'Spatial Computing Enters the Mainstream',
    category: 'Hardware',
    time: '6 hours ago',
    readTime: '6 min read',
    author: 'TechPulse AI',
    growth: '+195%',
    trendScore: 92,
    location: 'North America',
    image: 'https://images.unsplash.com/photo-1617802690992-15d93263d3a9?auto=format&fit=crop&q=80&w=1000',
    content: 'Apple Vision Pro\'s launch triggered a spatial computing gold rush. Developers are building mixed reality apps at record pace, with 50,000+ apps submitted to Apple\'s visionOS App Store.\n\nEnterprise adoption is leading the charge — from surgical training to remote collaboration, spatial computing is solving real problems.\n\nAnalysts forecast the spatial computing market to hit $620B by 2030.',
    graph: {
        chartData: [{ month: 'Jan', value: 10 }, { month: 'Feb', value: 20 }, { month: 'Mar', value: 40 }, { month: 'Apr', value: 50 }, { month: 'May', value: 70 }, { month: 'Jun', value: 92 }],
        metrics: { peakVolume: '150k', dailyEngagers: '22.1k', topRegion: 'North Am.', shareRate: '18.5%' }
    }
  },
  {
    trendId: '4',
    title: 'Neuroscience AI: Reading the Human Brain',
    category: 'Healthcare',
    time: '8 hours ago',
    readTime: '7 min read',
    author: 'MedTrend AI',
    growth: '+142%',
    trendScore: 88,
    location: 'Global',
    image: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&q=80&w=1000',
    content: 'Brain-computer interfaces are moving from science fiction to clinical reality. Neuralink, Synchron, and BrainGate are pioneering neural interfaces that restore movement in paralyzed patients.\n\nRecent breakthroughs include AI models that can decode speech from brain signals with 90%+ accuracy.\n\nThe global neurotechnology market is projected to reach $35B by 2027, driven by aging populations and neurological disease rates.',
    graph: {
        chartData: [{ month: 'Jan', value: 15 }, { month: 'Feb', value: 25 }, { month: 'Mar', value: 30 }, { month: 'Apr', value: 45 }, { month: 'May', value: 65 }, { month: 'Jun', value: 80 }],
        metrics: { peakVolume: '88k', dailyEngagers: '9.2k', topRegion: 'Global', shareRate: '15.2%' }
    }
  },
  {
    trendId: '5',
    title: 'AI Agents: Autonomous Digital Workers',
    category: 'AI',
    time: '1 hour ago',
    readTime: '5 min read',
    author: 'TrendPulse AI',
    growth: '+380%',
    trendScore: 99,
    location: 'Global',
    image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=1000',
    content: 'AI agents are taking over repetitive digital tasks — booking meetings, writing code, managing emails, and even making purchases autonomously.\n\nOpenAI\'s Operator, Anthropic\'s Claude, and Google\'s Project Jarvis are competing to build the most capable digital worker.\n\nEnterprises adopting AI agents report 40-70% productivity gains in knowledge work.',
    graph: {
        chartData: [{ month: 'Jan', value: 40 }, { month: 'Feb', value: 50 }, { month: 'Mar', value: 65 }, { month: 'Apr', value: 80 }, { month: 'May', value: 95 }, { month: 'Jun', value: 100 }],
        metrics: { peakVolume: '200k', dailyEngagers: '45.8k', topRegion: 'Global', shareRate: '22.4%' }
    }
  }
];

const seedDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/trendpulse';
    await mongoose.connect(mongoUri);
    
    console.log('MongoDB connected. Dropping old trends data...');
    await Trend.deleteMany();
    
    console.log('Inserting new trend data...');
    await Trend.insertMany(TRENDS_DATA);
    
    console.log('Data Successfully Seeded!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedDB();
