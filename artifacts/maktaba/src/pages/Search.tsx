import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useGetSearchSuggestions, useListProducts } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search as SearchIcon, BookOpen, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import useDebounce from "@/hooks/use-debounce"; // Will create this

export default function Search() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialQuery = searchParams.get("q") || "";
  
  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(query, 300);
  const [isFocused, setIsFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("maktaba_recent_searches");
    if (saved) {
      try { setRecentSearches(JSON.parse(saved)); } catch { setRecentSearches([]); }
    }
  }, []);

  const saveRecentSearch = (term: string) => {
    if (!term.trim()) return;
    const updated = [term, ...recentSearches.filter(s => s !== term)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem("maktaba_recent_searches", JSON.stringify(updated));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      saveRecentSearch(query);
      setLocation(`/search?q=${encodeURIComponent(query)}`);
      setIsFocused(false);
    }
  };

  const handleSuggestionClick = (term: string) => {
    setQuery(term);
    saveRecentSearch(term);
    setLocation(`/search?q=${encodeURIComponent(term)}`);
    setIsFocused(false);
  };

  const { data: suggestionsData, isLoading: isLoadingSuggestions } = useGetSearchSuggestions(
    { q: debouncedQuery },
    { query: { queryKey: ['/api/search/suggestions', { q: debouncedQuery }], enabled: debouncedQuery.length > 1 && isFocused } }
  );

  const { data: resultsData, isLoading: isLoadingResults } = useListProducts(
    { q: initialQuery },
    { query: { queryKey: ['/api/products', { q: initialQuery }], enabled: !!initialQuery && !isFocused } }
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8 relative z-20">
        <form onSubmit={handleSearch} className="relative">
          <div className="relative">
            <Input 
              autoFocus
              placeholder="ابحث عن كتاب، دار نشر، أو مؤلف..." 
              className="h-14 pl-12 pr-4 text-lg rounded-2xl shadow-sm border-primary/20 focus-visible:ring-primary/20"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            />
            <Button 
              type="submit" 
              size="icon" 
              variant="ghost" 
              className="absolute left-2 top-2 h-10 w-10 text-primary hover:bg-primary/10"
            >
              <SearchIcon className="h-5 w-5" />
            </Button>
          </div>

          {/* Suggestions Dropdown */}
          {isFocused && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-background rounded-xl shadow-lg border p-2 z-50">
              {debouncedQuery.length > 1 ? (
                isLoadingSuggestions ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">جاري البحث...</div>
                ) : suggestionsData?.products?.length === 0 && suggestionsData?.suggestions?.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">لم نجد نتائج لـ "{debouncedQuery}"</div>
                ) : (
                  <div className="space-y-4">
                    {suggestionsData?.suggestions?.length ? (
                       <div>
                         <div className="text-xs font-semibold text-muted-foreground px-3 mb-2">كلمات مقترحة</div>
                         {suggestionsData.suggestions.map((s, i) => (
                           <div 
                             key={i} 
                             className="px-3 py-2 hover:bg-muted rounded-md cursor-pointer flex items-center gap-2"
                             onClick={() => handleSuggestionClick(s)}
                           >
                             <SearchIcon className="h-4 w-4 text-muted-foreground" />
                             <span>{s}</span>
                           </div>
                         ))}
                       </div>
                    ) : null}
                    
                    {suggestionsData?.products?.length ? (
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground px-3 mb-2">كتب</div>
                        {suggestionsData.products.map(p => (
                          <div 
                            key={p.id} 
                            className="px-3 py-2 hover:bg-muted rounded-md cursor-pointer flex items-center gap-3"
                            onClick={() => {
                              saveRecentSearch(debouncedQuery);
                              setLocation(`/product/${p.slug}`);
                            }}
                          >
                            <div className="w-8 h-10 bg-muted rounded overflow-hidden">
                               {p.coverImage ? (
                                  <img src={p.coverImage} alt={p.nameAr} className="w-full h-full object-cover" />
                                ) : (
                                  <BookOpen className="w-full h-full p-2 text-muted-foreground/50" />
                                )}
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <div className="text-sm font-bold truncate">{p.nameAr}</div>
                              <div className="text-xs text-muted-foreground">{p.publisher}</div>
                            </div>
                            <div className="font-bold text-sm text-primary">{p.price} ج.م</div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              ) : recentSearches.length > 0 ? (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground px-3 mb-2 flex justify-between items-center">
                    <span>عمليات البحث الأخيرة</span>
                    <button type="button" className="text-primary hover:underline" onClick={(e) => { e.preventDefault(); setRecentSearches([]); localStorage.removeItem("maktaba_recent_searches"); }}>مسح</button>
                  </div>
                  {recentSearches.map((s, i) => (
                    <div 
                      key={i} 
                      className="px-3 py-2 hover:bg-muted rounded-md cursor-pointer flex items-center gap-2"
                      onClick={() => handleSuggestionClick(s)}
                    >
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground text-sm">اكتب كلمة للبحث...</div>
              )}
            </div>
          )}
        </form>
      </div>

      {/* Results Area */}
      {!isFocused && initialQuery && (
        <div>
          <h2 className="text-xl font-bold mb-6">نتائج البحث عن: "{initialQuery}"</h2>
          
          {isLoadingResults ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array(8).fill(0).map((_, i) => (
                <Card key={i} className="overflow-hidden border-border/50">
                  <Skeleton className="h-48 w-full rounded-none" />
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-6 w-1/3 mt-4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : resultsData?.items.length === 0 ? (
            <div className="text-center py-20">
              <SearchIcon className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-xl font-bold mb-2">لم نجد أي نتائج</h3>
              <p className="text-muted-foreground">تأكد من كتابة الكلمة بشكل صحيح أو جرب كلمات أخرى.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {resultsData?.items.map((product) => (
                <Link key={product.id} href={`/product/${product.slug}`}>
                  <Card className="h-full overflow-hidden hover-elevate border-border/50 transition-all hover:border-secondary cursor-pointer group flex flex-col">
                    <div className="aspect-[3/4] bg-muted relative overflow-hidden shrink-0">
                      {product.coverImage ? (
                        <img src={product.coverImage} alt={product.nameAr} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary/5 text-primary/40">
                          <BookOpen className="w-12 h-12" />
                        </div>
                      )}
                      {!product.inStock && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center backdrop-blur-[2px]">
                          <Badge variant="outline" className="bg-background text-muted-foreground font-bold">نفذت الكمية</Badge>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4 flex-1 flex flex-col">
                      <div className="text-xs text-muted-foreground mb-1">{product.publisher}</div>
                      <h3 className="font-bold text-sm mb-2 line-clamp-2 leading-tight group-hover:text-secondary">{product.nameAr}</h3>
                      <div className="mt-auto pt-2">
                        <span className="font-black text-lg text-primary">{product.price} ج.م</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
