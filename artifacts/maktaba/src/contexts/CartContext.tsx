import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useGetCart, Cart } from '@workspace/api-client-react';

interface CartContextType {
  cart: Cart | null;
  isLoading: boolean;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { data: cart, isLoading } = useGetCart({ query: { retry: false } });

  const itemCount = useMemo(() => {
    if (!cart) return 0;
    return cart.items.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  return (
    <CartContext.Provider value={{ cart: cart || null, isLoading, itemCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCartContext() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCartContext must be used within a CartProvider');
  }
  return context;
}
