import { useState } from 'react';
import { Sparkles, TrendingUp, Calendar, MapPin, ExternalLink } from 'lucide-react';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';

export default function App() {
  const [loading, setLoading] = useState(false);

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
                      onClick={() => setLoading(true)}
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