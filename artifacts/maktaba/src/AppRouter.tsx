import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";

const CustomerLayout = lazy(() => import("@/components/layout/CustomerLayout").then(module => ({ default: module.CustomerLayout })));
const AdminLayout = lazy(() => import("@/components/layout/AdminLayout").then(module => ({ default: module.AdminLayout })));
const Home = lazy(() => import("@/pages/Home"));
const Catalog = lazy(() => import("@/pages/Catalog"));
const ProductDetail = lazy(() => import("@/pages/ProductDetail"));
const Cart = lazy(() => import("@/pages/Cart"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const OrderConfirmation = lazy(() => import("@/pages/OrderConfirmation"));
const Search = lazy(() => import("@/pages/Search"));
const Account = lazy(() => import("@/pages/Account"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const TrackOrder = lazy(() => import("@/pages/TrackOrder"));
const OrderDetail = lazy(() => import("@/pages/OrderDetail"));
const InformationPage = lazy(() => import("@/pages/InformationPage"));
const OffersPage = lazy(() => import("@/pages/ExplorePages").then(module => ({ default: module.OffersPage })));
const PublishersPage = lazy(() => import("@/pages/ExplorePages").then(module => ({ default: module.PublishersPage })));
const CategoriesPage = lazy(() => import("@/pages/ExplorePages").then(module => ({ default: module.CategoriesPage })));
const StagesPage = lazy(() => import("@/pages/ExplorePages").then(module => ({ default: module.StagesPage })));
const CategoryCatalogPage = lazy(() => import("@/pages/EntityCatalogPage").then(module => ({ default: module.CategoryCatalogPage })));
const PublisherCatalogPage = lazy(() => import("@/pages/EntityCatalogPage").then(module => ({ default: module.PublisherCatalogPage })));
const AdminLogin = lazy(() => import("@/pages/AdminLogin"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const AdminProducts = lazy(() => import("@/pages/AdminProducts"));
const AdminProductForm = lazy(() => import("@/pages/Stubs").then(module => ({ default: module.AdminProductForm })));
const AdminOrders = lazy(() => import("@/pages/AdminOrders").then(module => ({ default: module.AdminOrders })));
const AdminOrderDetail = lazy(() => import("@/pages/AdminOrders").then(module => ({ default: module.AdminOrderDetail })));
const AdminCustomers = lazy(() => import("@/pages/AdminSections").then(module => ({ default: module.AdminCustomers })));
const AdminInventory = lazy(() => import("@/pages/AdminSections").then(module => ({ default: module.AdminInventory })));
const AdminCoupons = lazy(() => import("@/pages/AdminOperations").then(module => ({ default: module.AdminCoupons })));
const AdminShipping = lazy(() => import("@/pages/AdminOperations").then(module => ({ default: module.AdminShipping })));
const AdminClassifications = lazy(() => import("@/pages/AdminOperations").then(module => ({ default: module.AdminClassifications })));
const AdminContent = lazy(() => import("@/pages/AdminContent"));
const AdminReports = lazy(() => import("@/pages/AdminSections").then(module => ({ default: module.AdminReports })));
const AdminEmployees = lazy(() => import("@/pages/AdminSections").then(module => ({ default: module.AdminEmployees })));
const NotFound = lazy(() => import("@/pages/not-found"));

export function AppRouter() {
  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">جاري تحميل الصفحة...</div>}><Switch>
      {/* Admin: login (no layout) */}
      <Route path="/admin/login" component={AdminLogin} />

      {/* Admin: protected routes with AdminLayout */}
      <Route path="/admin">
        {() => (
          <AdminLayout requiredPermission="dashboard.view">
            <Switch>
              <Route path="/admin" component={AdminDashboard} />
              <Route component={NotFound} />
            </Switch>
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/products/new">
        {() => (
          <AdminLayout requiredPermission="products.create">
            <AdminProductForm />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/products/:id/edit">
        {() => (
          <AdminLayout requiredPermission="products.edit">
            <AdminProductForm />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/products">
        {() => (
          <AdminLayout requiredPermission="products.view">
            <AdminProducts />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/orders/:id">
        {() => (
          <AdminLayout requiredPermission="orders.view">
            <AdminOrderDetail />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/orders">
        {() => (
          <AdminLayout requiredPermission="orders.view">
            <AdminOrders />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/customers">{() => <AdminLayout requiredPermission="customers.view"><AdminCustomers /></AdminLayout>}</Route>
      <Route path="/admin/inventory">{() => <AdminLayout requiredPermission="inventory.view"><AdminInventory /></AdminLayout>}</Route>
      <Route path="/admin/coupons">{() => <AdminLayout requiredPermission="coupons.view"><AdminCoupons /></AdminLayout>}</Route>
      <Route path="/admin/shipping">{() => <AdminLayout requiredPermission="shipping.view"><AdminShipping /></AdminLayout>}</Route>
      <Route path="/admin/classifications">{() => <AdminLayout requiredPermission="classifications.view"><AdminClassifications /></AdminLayout>}</Route>
      <Route path="/admin/content">{() => <AdminLayout requiredPermission="content.view"><AdminContent /></AdminLayout>}</Route>
      <Route path="/admin/reports">{() => <AdminLayout requiredPermission="reports.view"><AdminReports /></AdminLayout>}</Route>
      <Route path="/admin/employees">{() => <AdminLayout requiredPermission="employees.manage"><AdminEmployees /></AdminLayout>}</Route>
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
        {() => (
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
      <Route path="/forgot-password">{() => <CustomerLayout><ForgotPassword /></CustomerLayout>}</Route>
      <Route path="/reset-password">{() => <CustomerLayout><ResetPassword /></CustomerLayout>}</Route>
      <Route path="/account">
        {() => (
          <CustomerLayout>
            <Account />
          </CustomerLayout>
        )}
      </Route>
      <Route path="/orders/:id">{() => <CustomerLayout><OrderDetail /></CustomerLayout>}</Route>
      <Route path="/track">{() => <CustomerLayout><TrackOrder /></CustomerLayout>}</Route>
      <Route path="/offers">{() => <CustomerLayout><OffersPage /></CustomerLayout>}</Route>
      <Route path="/publishers">{() => <CustomerLayout><PublishersPage /></CustomerLayout>}</Route>
      <Route path="/categories">{() => <CustomerLayout><CategoriesPage /></CustomerLayout>}</Route>
      <Route path="/category/:slug">{() => <CustomerLayout><CategoryCatalogPage /></CustomerLayout>}</Route>
      <Route path="/publisher/:reference">{() => <CustomerLayout><PublisherCatalogPage /></CustomerLayout>}</Route>
      <Route path="/stages">{() => <CustomerLayout><StagesPage /></CustomerLayout>}</Route>
      {["/about", "/contact", "/faq", "/shipping-policy", "/return-policy", "/privacy", "/terms"].map(path => <Route key={path} path={path}>{() => <CustomerLayout><InformationPage /></CustomerLayout>}</Route>)}
      <Route>
        {() => (
          <CustomerLayout>
            <NotFound />
          </CustomerLayout>
        )}
      </Route>
    </Switch></Suspense>
  );
}
