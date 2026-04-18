import { useState } from 'react';
import { Sparkles, TrendingUp, Calendar, MapPin, ExternalLink, ArrowLeft, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Separator } from './components/ui/separator';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState<number | null>(null);

  const cubsGames = [
    {
      id: 1,
      opponent: 'vs Milwaukee Brewers',
      date: 'May 15, 2026',
      time: '7:05 PM',
      venue: 'Wrigley Field',
      city: 'Chicago, IL',
      avgPrice: '$245',
      demand: 'High',
      dealScore: 85
    },
    {
      id: 2,
      opponent: 'vs St. Louis Cardinals',
      date: 'May 22, 2026',
      time: '1:20 PM',
      venue: 'Wrigley Field',
      city: 'Chicago, IL',
      avgPrice: '$312',
      demand: 'Very High',
      dealScore: 92
    },
    {
      id: 3,
      opponent: 'vs Cincinnati Reds',
      date: 'May 28, 2026',
      time: '7:05 PM',
      venue: 'Wrigley Field',
      city: 'Chicago, IL',
      avgPrice: '$198',
      demand: 'Medium',
      dealScore: 76
    },
    {
      id: 4,
      opponent: 'vs Pittsburgh Pirates',
      date: 'June 3, 2026',
      time: '6:40 PM',
      venue: 'Wrigley Field',
      city: 'Chicago, IL',
      avgPrice: '$185',
      demand: 'Medium',
      dealScore: 71
    },
    {
      id: 5,
      opponent: 'vs New York Yankees',
      date: 'June 12, 2026',
      time: '7:05 PM',
      venue: 'Wrigley Field',
      city: 'Chicago, IL',
      avgPrice: '$428',
      demand: 'Very High',
      dealScore: 95
    },
    {
      id: 6,
      opponent: 'vs Atlanta Braves',
      date: 'June 18, 2026',
      time: '1:20 PM',
      venue: 'Wrigley Field',
      city: 'Chicago, IL',
      avgPrice: '$267',
      demand: 'High',
      dealScore: 82
    }
  ];

  const getDemandColor = (demand: string) => {
    if (demand === 'Very High') return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (demand === 'High') return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400';
    if (score >= 80) return 'text-green-400';
    if (score >= 70) return 'text-yellow-400';
    return 'text-slate-400';
  };

  const aiAnalysis = {
    verdict: 'Strong Buy',
    summary: 'High-demand game at iconic Wrigley — expect premium pricing with limited bargains.',
    insights: [
      {
        type: 'positive',
        title: 'Best Value Pick',
        text: 'Wrigley Field bleacher seats offer the best value. 74 typically recommend upper deck or bleacher seats for this matchup. Both teams have solid followings, but weekend afternoon games are generally less crowded than night games, despite the 1:20 PM start which can attract tourists.'
      },
      {
        type: 'warning',
        title: 'Price Check Suggestion',
        text: 'This game is also listed on StubHub (event ID: 153257850) and Vivid Seats (event ID: 5966521) — definitely compare prices across all these platforms before buying. High-demand Wrigley games often show significant price variation between sites.'
      },
      {
        type: 'info',
        title: 'Final Verdict',
        text: 'Wait if you can — Sunday games at Wrigley start expensive and sometimes drop closer to game day. However, with the 0.93 popularity score, don\'t wait too long or you\'ll miss your preferred section or completely sell out.'
      }
    ],
    platforms: [
      { name: 'SeatGeek', price: '$245-$380', link: 'https://seatgeek.com' },
      { name: 'Ticketmaster', price: '$268-$415', link: 'https://ticketmaster.com' },
      { name: 'StubHub', price: '$255-$395', link: 'https://stubhub.com' }
    ]
  };

  if (selectedGame !== null) {
    const game = cubsGames.find(g => g.id === selectedGame);
    if (!game) return null;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl tracking-tight">
                  <span className="text-white">SEAT</span>
                  <span className="text-blue-500">GENIUS</span>
                  <span className="text-blue-400">.</span>
                </h1>
                <p className="text-sm text-slate-400 mt-1">Find the best deal on Cubs tickets at Wrigley Field</p>
              </div>
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                Powered by AI
              </Badge>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-8">
          <Button
            variant="ghost"
            className="text-slate-400 hover:text-white mb-6"
            onClick={() => setSelectedGame(null)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cubs Schedule
          </Button>

          {/* Game Header */}
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm mb-6">
            <CardContent className="p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-3xl text-white mb-3">Mets at Cubs</h2>
                  <div className="flex flex-wrap gap-4 text-slate-300">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-500" />
                      Sun, Apr 18 • 1:20 PM
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-500" />
                      Wrigley Field, Chicago
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30 text-sm px-4 py-1">
                  Very High Demand
                </Badge>
              </div>

            </CardContent>
          </Card>

          {/* Platform Comparison */}
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm mb-6">
            <CardHeader>
              <CardTitle className="text-white">Price Comparison Across Platforms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {aiAnalysis.platforms.map((platform, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-slate-950/50 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors">
                  <div>
                    <p className="text-white mb-1">{platform.name}</p>
                    <p className="text-sm text-slate-400">{platform.price}</p>
                  </div>
                  <Button variant="outline" size="sm" className="border-slate-700 hover:bg-slate-800" asChild>
                    <a href={platform.link} target="_blank" rel="noopener noreferrer">
                      View <ExternalLink className="ml-2 h-3 w-3" />
                    </a>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* AI Analysis */}
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Sparkles className="h-5 w-5 text-blue-500" />
                  AI Ticket Analysis: Mets @ Cubs at Wrigley
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Verdict */}
              <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <div className="flex items-start gap-3 mb-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xl text-emerald-400 mb-2">1. Overall Verdict</h3>
                    <p className="text-emerald-100">{aiAnalysis.summary}</p>
                  </div>
                </div>
              </div>

              {/* Insights */}
              {aiAnalysis.insights.map((insight, idx) => {
                const Icon = insight.type === 'positive' ? CheckCircle2 : insight.type === 'warning' ? AlertTriangle : Info;
                const colors = {
                  positive: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-300', icon: 'text-emerald-400', title: 'text-emerald-300' },
                  warning: { bg: 'bg-amber-500/5', border: 'border-amber-500/20', text: 'text-amber-200', icon: 'text-amber-400', title: 'text-amber-300' },
                  info: { bg: 'bg-blue-500/5', border: 'border-blue-500/20', text: 'text-blue-200', icon: 'text-blue-400', title: 'text-blue-300' }
                };
                const colorScheme = colors[insight.type as keyof typeof colors];

                return (
                  <div key={idx} className={`p-6 rounded-lg border ${colorScheme.bg} ${colorScheme.border}`}>
                    <div className="flex items-start gap-3">
                      <Icon className={`h-5 w-5 ${colorScheme.icon} flex-shrink-0 mt-1`} />
                      <div>
                        <h3 className={`text-lg mb-2 ${colorScheme.title}`}>{idx + 2}. {insight.title}</h3>
                        <p className={`${colorScheme.text} leading-relaxed`}>{insight.text}</p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Action Button */}
              <div className="pt-4">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" size="lg">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Get AI Deal Analysis
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Vercel Attribution */}
          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500">@ AI Verdict</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl tracking-tight">
                <span className="text-white">SEAT</span>
                <span className="text-blue-500">GENIUS</span>
                <span className="text-blue-400">.</span>
              </h1>
              <p className="text-sm text-slate-400 mt-1">Find the best deal on scalp tickets at bargain cost</p>
            </div>
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              Powered by AI
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-2xl text-white mb-2">Chicago Cubs Home Games</h2>
          <p className="text-slate-400">Upcoming games at Wrigley Field</p>
        </div>

        <div className="grid gap-4">
          {cubsGames.map((game) => (
            <Card key={game.id} className="bg-slate-900/50 border-slate-800 backdrop-blur-sm hover:border-slate-700 transition-colors">
              <CardContent className="p-6">
                <div className="grid md:grid-cols-[1fr_auto] gap-6">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-xl text-white mb-2">{game.opponent}</h3>
                        <div className="flex flex-wrap gap-3 text-sm text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4" />
                            {game.date} • {game.time}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4" />
                            {game.venue}, {game.city}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className={getDemandColor(game.demand)}>
                        {game.demand} Demand
                      </Badge>
                    </div>

                    <div className="flex items-center gap-6">
                      <div>
                        <p className="text-sm text-slate-400 mb-1">Average Price</p>
                        <p className="text-2xl text-white">{game.avgPrice}</p>
                      </div>
                      <div className="h-12 w-px bg-slate-700"></div>
                      <div>
                        <p className="text-sm text-slate-400 mb-1">Deal Score</p>
                        <p className={`text-2xl ${getScoreColor(game.dealScore)}`}>
                          {game.dealScore}/100
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex md:flex-col gap-2 md:justify-center">
                    <Button
                      className="flex-1 md:flex-initial bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => setSelectedGame(game.id)}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Analyze Deal
                    </Button>
                    <Button variant="outline" className="flex-1 md:flex-initial border-slate-700 hover:bg-slate-800" asChild>
                      <a href="https://seatgeek.com" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View Tickets
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}