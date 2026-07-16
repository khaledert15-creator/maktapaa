import { CustomerLayout } from "@/components/layout/CustomerLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import Home from "@/pages/Home";
import Catalog from "@/pages/Catalog";
import ProductDetail from "@/pages/ProductDetail";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import OrderConfirmation from "@/pages/OrderConfirmation";
import Search from "@/pages/Search";
import Account from "@/pages/Account";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminProducts from "@/pages/AdminProducts";
import { AdminProductForm, AdminOrders, AdminOrderDetail } from "@/pages/Stubs";
import { AdminCustomers, AdminInventory, AdminCoupons, AdminShipping, AdminClassifications, AdminContent, AdminReports, AdminEmployees } from "@/pages/AdminSections";
import { Route, Switch } from "wouter";
import NotFound from "@/pages/not-found";

export function AppRouter() {
  return (
    <Switch>
      {/* Admin: login (no layout) */}
      <Route path="/admin/login" component={AdminLogin} />

      {/* Admin: protected routes with AdminLayout */}
      <Route path="/admin">
        {() => (
          <AdminLayout>
            <Switch>
              <Route path="/admin" component={AdminDashboard} />
              <Route component={NotFound} />
            </Switch>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/products/new">
        {() => (
          <AdminLayout>
            <AdminProductForm />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/products/:id/edit">
        {() => (
          <AdminLayout>
            <AdminProductForm />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/products">
        {() => (
          <AdminLayout>
            <AdminProducts />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/orders/:id">
        {() => (
          <AdminLayout>
            <AdminOrderDetail />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/orders">
        {() => (
          <AdminLayout>
            <AdminOrders />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/customers">{() => <AdminLayout><AdminCustomers /></AdminLayout>}</Route>
      <Route path="/admin/inventory">{() => <AdminLayout><AdminInventory /></AdminLayout>}</Route>
      <Route path="/admin/coupons">{() => <AdminLayout><AdminCoupons /></AdminLayout>}</Route>
      <Route path="/admin/shipping">{() => <AdminLayout><AdminShipping /></AdminLayout>}</Route>
      <Route path="/admin/classifications">{() => <AdminLayout><AdminClassifications /></AdminLayout>}</Route>
      <Route path="/admin/content">{() => <AdminLayout><AdminContent /></AdminLayout>}</Route>
      <Route path="/admin/reports">{() => <AdminLayout><AdminReports /></AdminLayout>}</Route>
      <Route path="/admin/employees">{() => <AdminLayout><AdminEmployees /></AdminLayout>}</Route>
      <Route path="/admin/:rest*">
        {() => (
          <AdminLayout>
            <NotFound />
          </AdminLayout>
        )}
      </Route>

      {/* Customer routes with CustomerLayout */}
      <Route path="/">
        {() => (
          <CustomerLayout>
            <Home />
          </CustomerLayout>
        )}
      </Route>
      <Route path="/catalog">
        {() => (
          <CustomerLayout>
            <Catalog />
          </CustomerLayout>
        )}
      </Route>
      <Route path="/product/:slug">
        {(params) => (
          <CustomerLayout>
            <ProductDetail />
          </CustomerLayout>
        )}
      </Route>
      <Route path="/cart">
        {() => (
          <CustomerLayout>
            <Cart />
          </CustomerLayout>
        )}
      </Route>
      <Route path="/checkout">
        {() => (
          <CustomerLayout>
            <Checkout />
          </CustomerLayout>
        )}
      </Route>
      <Route path="/order-confirmation/:orderNumber">
        {() => (
          <CustomerLayout>
            <OrderConfirmation />
          </CustomerLayout>
        )}
      </Route>
      <Route path="/search">
        {() => (
          <CustomerLayout>
            <Search />
          </CustomerLayout>
        )}
      </Route>
      <Route path="/login">
        {() => (
          <CustomerLayout>
            <Login />
          </CustomerLayout>
        )}
      </Route>
      <Route path="/register">
        {() => (
          <CustomerLayout>
            <Register />
          </CustomerLayout>
        )}
      </Route>
      <Route path="/account">
        {() => (
          <CustomerLayout>
            <Account />
          </CustomerLayout>
        )}
      </Route>
      <Route>
        {() => (
          <CustomerLayout>
            <NotFound />
          </CustomerLayout>
        )}
      </Route>
    </Switch>
  );
}
