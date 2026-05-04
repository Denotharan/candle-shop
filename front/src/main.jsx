import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
const currency = (value) => `$${Number(value).toFixed(2)}`
const getStored = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

async function api(path, options = {}) {
  const token = localStorage.getItem('token')
  const headers = { ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await response.json() : null
  if (!response.ok) {
    throw new Error(data?.detail || 'Something went wrong.')
  }
  return data
}

function App() {
  const [path, setPath] = useState(window.location.pathname)
  const [query, setQuery] = useState(new URLSearchParams(window.location.search))
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState({})
  const [user, setUser] = useState(() => getStored('user', null))
  const [messages, setMessages] = useState([])
  const [themeTick, setThemeTick] = useState(0)

  const navigate = (to) => {
    window.history.pushState({}, '', to)
    setPath(window.location.pathname)
    setQuery(new URLSearchParams(window.location.search))
    window.scrollTo(0, 0)
  }

  React.useEffect(() => {
    const onPop = () => {
      setPath(window.location.pathname)
      setQuery(new URLSearchParams(window.location.search))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const flash = (message) => setMessages([message])
  const saveAuth = (payload) => {
    localStorage.setItem('token', payload.token)
    setUser(payload.user)
    localStorage.setItem('user', JSON.stringify(payload.user))
  }
  const clearAuth = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    setCart({})
  }

  const loadProducts = async () => setProducts(await api('/products'))
  const loadCart = async () => setCart(await api('/cart'))

  useEffect(() => {
    loadProducts().catch(() => flash('FastAPI backend is not running. Start it on port 8000.'))
    if (localStorage.getItem('token')) {
      api('/auth/me')
        .then((currentUser) => {
          setUser(currentUser)
          localStorage.setItem('user', JSON.stringify(currentUser))
          return loadCart()
        })
        .catch(() => clearAuth())
    }
  }, [])

  const actions = {
    navigate,
    flash,
    async login(email, password) {
      try {
        const payload = await api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
        saveAuth(payload)
        await loadCart()
        navigate(payload.user.is_admin ? '/admin' : '/')
      } catch (error) {
        flash(error.message)
      }
    },
    async register(name, email, password) {
      try {
        const payload = await api('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password }),
        })
        saveAuth(payload)
        await loadCart()
        navigate('/')
      } catch (error) {
        flash(error.message)
      }
    },
    logout() {
      clearAuth()
      navigate('/')
    },
    loginGoogle() {
      flash('Google Login is not configured yet. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env')
      navigate('/login')
    },
    async addToCart(productId) {
      const product = products.find((item) => item.id === productId)
      if (!user) {
        flash('Please sign in before adding items to your bag.')
        navigate('/login')
        return
      }
      try {
        setCart(await api(`/cart/items/${productId}`, { method: 'POST' }))
        flash(`Added ${product.name} to cart.`)
        navigate('/')
      } catch (error) {
        flash(error.message)
      }
    },
    async removeFromCart(productId) {
      try {
        setCart(await api(`/cart/items/${productId}`, { method: 'DELETE' }))
      } catch (error) {
        flash(error.message)
      }
    },
    async checkout() {
      if (!Object.keys(cart).length) {
        flash('Your cart is empty.')
        navigate('/cart')
        return
      }
      try {
        await api('/checkout', { method: 'POST' })
        setCart({})
        navigate('/checkout_success')
      } catch (error) {
        flash(error.message)
      }
    },
    async addProduct(form) {
      const nextProduct = {
        name: form.get('name'),
        description: form.get('description'),
        price: Number(form.get('price')),
        scent_family: form.get('scent_family'),
        burn_time: form.get('burn_time'),
        stock_quantity: Number(form.get('stock')),
        image_url: form.get('image_url'),
        scent_profile: {
          top: form.get('scent_top') || 'N/A',
          middle: form.get('scent_mid') || 'N/A',
          base: form.get('scent_base') || 'N/A',
        },
      }
      try {
        await api('/products', {
          method: 'POST',
          body: JSON.stringify(nextProduct),
        })
        await loadProducts()
        flash('Product added successfully.')
      } catch (error) {
        flash(error.message)
      }
    },
    toggleTheme() {
      const html = document.documentElement
      if (localStorage.getItem('theme')) {
        if (localStorage.getItem('theme') === 'light') {
          html.classList.add('dark')
          localStorage.setItem('theme', 'dark')
        } else {
          html.classList.remove('dark')
          localStorage.setItem('theme', 'light')
        }
      } else if (html.classList.contains('dark')) {
        html.classList.remove('dark')
        localStorage.setItem('theme', 'light')
      } else {
        html.classList.add('dark')
        localStorage.setItem('theme', 'dark')
      }
      setThemeTick(themeTick + 1)
    },
  }

  const page = useMemo(() => {
    if (path.startsWith('/product/')) return <ProductDetail product={products.find((item) => item.id === Number(path.split('/').pop()))} actions={actions} />
    if (path === '/cart') return <Cart products={products} cart={cart} actions={actions} />
    if (path === '/login') return <Login actions={actions} />
    if (path === '/register') return <Register actions={actions} />
    if (path === '/admin') return user?.is_admin ? <Admin products={products} actions={actions} /> : <Login actions={actions} />
    if (path === '/checkout_success') return <Success actions={actions} />
    return <Home products={products} family={query.get('family')} actions={actions} />
  }, [path, query, products, cart, user, themeTick])

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F5F0] dark:bg-[#0a0a0a] text-[#121212] dark:text-[#F8F5F0] transition-colors duration-300">
      <Nav user={user} cart={cart} actions={actions} />
      <main className="flex-grow pt-20">
        {messages.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
            {messages.map((message) => (
              <div key={message} className="bg-white dark:bg-[#1E1E1E] border border-[#E5E5E5] dark:border-gray-800 text-[#121212] dark:text-[#F8F5F0] p-4 mb-4 text-center text-sm tracking-wide uppercase shadow-sm" role="alert">
                <p>{message}</p>
              </div>
            ))}
          </div>
        )}
        {page}
      </main>
      <Footer />
    </div>
  )
}

function Link({ to, className, children, actions, ...props }) {
  return <a href={to} className={className} onClick={(event) => { event.preventDefault(); actions.navigate(to) }} {...props}>{children}</a>
}

function Nav({ user, cart, actions }) {
  const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0)
  const isDark = document.documentElement.classList.contains('dark')
  return (
    <nav className="fixed w-full top-0 z-50 bg-[#F8F5F0]/80 dark:bg-[#0a0a0a]/80 backdrop-blur-md border-b border-[#E5E5E5] dark:border-gray-800 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center space-x-4">
            <Link to="/" actions={actions} className="text-xs uppercase tracking-widest text-[#121212] dark:text-[#F8F5F0] hover:text-[#D9B38C] dark:hover:text-[#D9B38C] transition-colors hidden sm:block">Shop</Link>
          </div>
          <div className="flex-1 flex justify-center">
            <Link to="/" actions={actions} className="text-3xl font-medium brand-font tracking-widest text-[#121212] dark:text-[#F8F5F0] uppercase">Serein</Link>
          </div>
          <div className="flex items-center space-x-6">
            <button onClick={actions.toggleTheme} className="text-[#121212] dark:text-[#F8F5F0] hover:text-[#D9B38C] dark:hover:text-[#D9B38C] transition-colors focus:outline-none" aria-label="Toggle Dark Mode">
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
            {user ? (
              <>
                <div className="relative group hidden sm:block">
                  <span className="text-xs uppercase tracking-widest text-[#121212] dark:text-[#F8F5F0] cursor-pointer hover:text-[#D9B38C] dark:hover:text-[#D9B38C] transition-colors">{user.name || 'Account'}</span>
                  <div className="absolute right-0 pt-4 hidden group-hover:block">
                    <div className="bg-white dark:bg-[#1E1E1E] border border-[#E5E5E5] dark:border-gray-800 p-4 min-w-[120px] shadow-lg flex flex-col space-y-3">
                      {user.is_admin && <Link to="/admin" actions={actions} className="block text-xs uppercase tracking-widest text-[#121212] dark:text-[#F8F5F0] hover:text-[#D9B38C] dark:hover:text-[#D9B38C] transition-colors">Admin</Link>}
                      <button onClick={actions.logout} className="text-left block text-xs uppercase tracking-widest text-gray-500 hover:text-[#121212] dark:hover:text-[#F8F5F0] transition-colors">Logout</button>
                    </div>
                  </div>
                </div>
                <button onClick={actions.logout} className="sm:hidden text-xs uppercase tracking-widest text-[#121212] dark:text-[#F8F5F0]">Logout</button>
              </>
            ) : (
              <Link to="/login" actions={actions} className="text-[#121212] dark:text-[#F8F5F0] hover:text-[#D9B38C] dark:hover:text-[#D9B38C] transition-colors" aria-label="Sign In"><UserIcon /></Link>
            )}
            <Link to="/cart" actions={actions} className="text-[#121212] dark:text-[#F8F5F0] hover:text-[#D9B38C] dark:hover:text-[#D9B38C] transition-colors relative" aria-label="Cart">
              <BagIcon />
              {cartCount > 0 && <span className="absolute -top-1 -right-2 bg-[#D9B38C] text-[#121212] text-[0.65rem] font-bold rounded-full h-4 w-4 flex items-center justify-center">{cartCount}</span>}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}

function Home({ products, family, actions }) {
  const filtered = family ? products.filter((product) => product.scent_family === family) : products
  const familyClass = (value) => (family === value || (!family && !value))
    ? 'text-[#121212] dark:text-[#F8F5F0] border-b border-[#121212] dark:border-[#F8F5F0] pb-1 transition-colors'
    : 'text-gray-400 hover:text-[#121212] dark:hover:text-[#F8F5F0] pb-1 transition-colors'
  return (
    <>
      <div className="relative w-full h-[80vh] bg-gray-200 dark:bg-gray-800">
        <div className="absolute inset-0"><img src="/c1.jpg" alt="Luxurious candles" className="w-full h-full object-cover opacity-80" /></div>
        <div className="absolute inset-0 bg-black/20 dark:bg-black/40"></div>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <h1 className="text-5xl md:text-7xl text-[#F8F5F0] brand-font mb-4 tracking-wider">The Art of Ambiance</h1>
          <p className="text-sm md:text-base text-[#F8F5F0] uppercase tracking-[0.3em] mb-10 max-w-2xl mx-auto font-light">Hand-poured fragrances for the modern sanctuary</p>
          <a href="#collection" className="text-[#F8F5F0] uppercase tracking-widest text-xs border-b border-[#F8F5F0] pb-1 hover:text-[#D9B38C] hover:border-[#D9B38C] transition-colors">Shop the Collection</a>
        </div>
      </div>
      <div id="collection" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <div className="text-center mb-16">
          <h2 className="text-4xl brand-font text-[#121212] dark:text-[#F8F5F0] mb-4 transition-colors duration-300">Curated Scents</h2>
          <div className="w-12 h-[1px] bg-[#D9B38C] mx-auto mb-10"></div>
          <div className="flex flex-wrap justify-center gap-6 text-xs uppercase tracking-widest">
            {[null, 'Floral', 'Woody', 'Citrus', 'Earthy'].map((item) => <Link key={item || 'All'} actions={actions} to={item ? `/?family=${item}` : '/'} className={familyClass(item)}>{item || 'All'}</Link>)}
          </div>
        </div>
        {filtered.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-16 sm:gap-x-8">
            {filtered.map((product) => <ProductCard key={product.id} product={product} actions={actions} />)}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-500 dark:text-gray-400 uppercase tracking-widest text-sm">No products found in this collection.</p>
            <Link to="/" actions={actions} className="inline-block mt-8 text-xs uppercase tracking-widest border-b border-[#121212] dark:border-[#F8F5F0] hover:text-[#D9B38C] dark:hover:text-[#D9B38C] hover:border-[#D9B38C] dark:hover:border-[#D9B38C] transition-colors pb-1 text-[#121212] dark:text-[#F8F5F0]">View all</Link>
          </div>
        )}
      </div>
      <div className="w-full bg-[#121212] dark:bg-black text-[#F8F5F0] py-24 text-center px-4 transition-colors duration-300">
        <h2 className="text-3xl md:text-5xl brand-font mb-6 tracking-wide">Crafted with Intention</h2>
        <p className="text-sm uppercase tracking-widest text-gray-400 max-w-xl mx-auto leading-relaxed">Every candle is meticulously hand-poured using sustainable soy wax and premium botanical oils to elevate your everyday rituals.</p>
      </div>
    </>
  )
}

function ProductCard({ product, actions }) {
  return (
    <div className="group relative block text-center">
      <Link to={`/product/${product.id}`} actions={actions} className="block">
        <ProductImage product={product} className="relative w-full aspect-[3/4] mb-6 overflow-hidden bg-white dark:bg-[#1E1E1E] transition-colors duration-300" imageClass="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-1000 ease-in-out" fallbackClass="w-full h-full bg-[#f0eae1] dark:bg-[#2A2A2A] flex items-center justify-center text-[#D9B38C] brand-font text-2xl tracking-widest uppercase transition-colors duration-300" />
        <div className="absolute inset-x-0 bottom-[5.6rem] p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end">
          <span className="w-full btn-primary block py-3 text-[0.65rem] uppercase tracking-[0.2em] bg-white text-[#121212] border-transparent dark:bg-[#F8F5F0] dark:text-[#121212] hover:bg-[#121212] hover:text-white dark:hover:bg-[#121212] dark:hover:text-[#F8F5F0] dark:hover:border-[#F8F5F0]">View Details</span>
        </div>
        <h3 className="text-lg text-[#121212] dark:text-[#F8F5F0] brand-font tracking-wide mb-2 transition-colors duration-300">{product.name}</h3>
        <p className="text-[0.65rem] text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">{product.scent_family}</p>
        <p className="text-sm text-[#121212] dark:text-[#F8F5F0] transition-colors duration-300">{currency(product.price)}</p>
      </Link>
    </div>
  )
}

function ProductDetail({ product, actions }) {
  if (!product) return <div className="text-center py-32 text-xs uppercase tracking-widest text-gray-500">Product not found.</div>
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
      <div className="md:grid md:grid-cols-2 md:gap-x-16 lg:gap-x-24">
        <div className="mb-12 md:mb-0"><ProductImage product={product} className="w-full aspect-[3/4] bg-white dark:bg-[#1E1E1E] transition-colors duration-300" imageClass="h-full w-full object-cover object-center" fallbackClass="h-full w-full bg-[#f0eae1] dark:bg-[#2A2A2A] flex items-center justify-center text-[#D9B38C] brand-font text-4xl tracking-widest uppercase transition-colors duration-300" /></div>
        <div className="flex flex-col justify-center pt-8 md:pt-0">
          <p className="text-[0.65rem] text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em] mb-4">{product.scent_family}</p>
          <h1 className="text-4xl md:text-5xl text-[#121212] dark:text-[#F8F5F0] brand-font mb-4 tracking-wide transition-colors duration-300">{product.name}</h1>
          <p className="text-lg text-[#121212] dark:text-[#F8F5F0] mb-10 transition-colors duration-300">{currency(product.price)}</p>
          <div className="text-sm text-gray-600 dark:text-gray-300 font-light leading-relaxed mb-12 transition-colors duration-300"><p>{product.description}</p></div>
          <div className="border-t border-[#E5E5E5] dark:border-gray-800 mb-10 transition-colors duration-300">
            <Detail title="Scent Profile">
              <div className="grid grid-cols-1 gap-y-4">
                <Info label="Top" value={product.scent_profile?.top || 'N/A'} />
                <Info label="Heart" value={product.scent_profile?.middle || 'N/A'} />
                <Info label="Base" value={product.scent_profile?.base || 'N/A'} />
              </div>
            </Detail>
            <Detail title="Product Details">
              <div className="space-y-3">
                <Info label="Burn Time" value={product.burn_time} />
                <div className="flex justify-between"><span className="uppercase">Availability</span><span className={product.stock_quantity > 0 ? 'text-[#121212] dark:text-[#F8F5F0]' : 'text-red-400 dark:text-red-400'}>{product.stock_quantity > 0 ? 'In Stock' : 'Sold Out'}</span></div>
              </div>
            </Detail>
          </div>
          <button onClick={() => actions.addToCart(product.id)} disabled={product.stock_quantity <= 0} className={`w-full btn-primary px-8 py-4 text-xs uppercase tracking-[0.2em] transition-all ${product.stock_quantity <= 0 ? 'opacity-50 cursor-not-allowed' : ''} dark:bg-[#F8F5F0] dark:text-[#121212] dark:border-[#F8F5F0] dark:hover:bg-transparent dark:hover:text-[#F8F5F0]`}>{product.stock_quantity > 0 ? 'Add to Bag' : 'Sold Out'}</button>
          <TrustBadges />
          <div className="mt-6 text-center"><p className="text-[0.6rem] uppercase tracking-widest text-gray-400 dark:text-gray-500">Free shipping on orders over $100</p></div>
        </div>
      </div>
    </div>
  )
}

function Cart({ products, cart, actions }) {
  const items = Object.entries(cart).map(([id, quantity]) => ({ product: products.find((item) => item.id === Number(id)), quantity })).filter((item) => item.product)
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
      <div className="text-center mb-16"><h1 className="text-4xl text-[#121212] dark:text-[#F8F5F0] brand-font mb-4 tracking-wide transition-colors duration-300">Your Bag</h1><div className="w-12 h-[1px] bg-[#D9B38C] mx-auto"></div></div>
      {items.length ? (
        <div className="lg:grid lg:grid-cols-12 lg:gap-x-16">
          <div className="lg:col-span-8">
            <div className="hidden md:grid grid-cols-6 gap-4 border-b border-[#121212] dark:border-[#F8F5F0] pb-4 mb-8 text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 transition-colors duration-300"><div className="col-span-3">Product</div><div className="col-span-1 text-center">Quantity</div><div className="col-span-2 text-right">Total</div></div>
            <ul className="divide-y divide-[#E5E5E5] dark:divide-gray-800 transition-colors duration-300">
              {items.map(({ product, quantity }) => <CartItem key={product.id} product={product} quantity={quantity} actions={actions} />)}
            </ul>
          </div>
          <div className="mt-16 lg:mt-0 lg:col-span-4"><OrderSummary total={total} actions={actions} /></div>
        </div>
      ) : (
        <div className="text-center py-20 max-w-lg mx-auto">
          <p className="text-gray-500 dark:text-gray-400 uppercase tracking-widest text-xs mb-8 transition-colors duration-300">Your bag is currently empty.</p>
          <Link to="/" actions={actions} className="btn-primary inline-block px-10 py-4 text-xs uppercase tracking-[0.2em] dark:bg-[#F8F5F0] dark:text-[#121212] dark:border-[#F8F5F0] dark:hover:bg-transparent dark:hover:text-[#F8F5F0]">Discover Our Scents</Link>
        </div>
      )}
    </div>
  )
}

function AuthCard({ title, subtitle, children }) {
  return <div className="min-h-[60vh] flex items-center justify-center py-20 px-4 sm:px-6 lg:px-8"><div className="max-w-md w-full p-10 bg-white dark:bg-[#1E1E1E] border border-[#E5E5E5] dark:border-gray-800 transition-colors duration-300"><div className="mb-10 text-center"><h2 className="text-3xl brand-font text-[#121212] dark:text-[#F8F5F0] mb-4 transition-colors duration-300">{title}</h2><div className="w-8 h-[1px] bg-[#D9B38C] mx-auto mb-6"></div><p className="text-[0.65rem] uppercase tracking-widest text-gray-500 dark:text-gray-400">{subtitle}</p></div>{children}</div></div>
}

function Login({ actions }) {
  const submit = (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); actions.login(form.get('email'), form.get('password')) }
  return <AuthCard title="Sign In" subtitle="Welcome back to Serein"><form className="space-y-6" onSubmit={submit}><Input name="email" type="text" placeholder="EMAIL OR USERNAME" /><Input name="password" type="password" placeholder="PASSWORD" /><button type="submit" className="w-full flex justify-center py-4 px-4 btn-primary text-xs uppercase tracking-[0.2em] dark:bg-[#F8F5F0] dark:text-[#121212] dark:border-[#F8F5F0] dark:hover:bg-transparent dark:hover:text-[#F8F5F0]">Sign In</button></form><Divider /><button onClick={actions.loginGoogle} className="w-full flex justify-center py-4 px-4 border border-[#E5E5E5] dark:border-gray-800 text-[#121212] dark:text-[#F8F5F0] text-xs uppercase tracking-[0.2em] hover:bg-[#F8F5F0] dark:hover:bg-[#2A2A2A] transition-colors duration-300 items-center space-x-3"><GoogleIcon /><span>Continue with Google</span></button><div className="mt-10 text-center"><p className="text-xs tracking-widest text-gray-500 dark:text-gray-400">New to Serein? <Link to="/register" actions={actions} className="text-[#121212] dark:text-[#F8F5F0] border-b border-[#121212] dark:border-[#F8F5F0] hover:text-[#D9B38C] dark:hover:text-[#D9B38C] dark:hover:border-[#D9B38C] transition-colors pb-1">Create an Account</Link></p></div></AuthCard>
}

function Register({ actions }) {
  const submit = (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); actions.register(form.get('name'), form.get('email'), form.get('password')) }
  return <AuthCard title="Create Account" subtitle="Join the Serein collective"><form className="space-y-6" onSubmit={submit}><Input name="name" placeholder="FULL NAME" /><Input name="email" type="email" placeholder="EMAIL ADDRESS" /><Input name="password" type="password" placeholder="PASSWORD" /><button type="submit" className="w-full flex justify-center py-4 px-4 btn-primary text-xs uppercase tracking-[0.2em] dark:bg-[#F8F5F0] dark:text-[#121212] dark:border-[#F8F5F0] dark:hover:bg-transparent dark:hover:text-[#F8F5F0]">Create Account</button></form><Divider /><button onClick={actions.loginGoogle} className="w-full flex justify-center py-4 px-4 border border-[#E5E5E5] dark:border-gray-800 text-[#121212] dark:text-[#F8F5F0] text-xs uppercase tracking-[0.2em] hover:bg-[#F8F5F0] dark:hover:bg-[#2A2A2A] transition-colors duration-300 items-center space-x-3"><GoogleIcon /><span>Sign up with Google</span></button><div className="mt-10 text-center"><p className="text-xs tracking-widest text-gray-500 dark:text-gray-400">Already have an account? <Link to="/login" actions={actions} className="text-[#121212] dark:text-[#F8F5F0] border-b border-[#121212] dark:border-[#F8F5F0] hover:text-[#D9B38C] dark:hover:text-[#D9B38C] dark:hover:border-[#D9B38C] transition-colors pb-1">Sign In</Link></p></div></AuthCard>
}

function Admin({ products, actions }) {
  const submit = (event) => { event.preventDefault(); actions.addProduct(new FormData(event.currentTarget)); event.currentTarget.reset() }
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="flex justify-between items-center mb-16 border-b border-[#E5E5E5] dark:border-gray-800 pb-6 transition-colors duration-300"><h1 className="text-4xl text-[#121212] dark:text-[#F8F5F0] brand-font tracking-wide transition-colors duration-300">Admin Dashboard</h1><button onClick={actions.logout} className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 hover:text-[#121212] dark:hover:text-[#F8F5F0] border-b border-transparent hover:border-[#121212] dark:hover:border-[#F8F5F0] transition-colors pb-1">Logout</button></div>
      <div className="lg:grid lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5 mb-16 lg:mb-0"><div className="bg-white dark:bg-[#1E1E1E] p-8 border border-[#E5E5E5] dark:border-gray-800 transition-colors duration-300"><h2 className="text-2xl text-[#121212] dark:text-[#F8F5F0] brand-font mb-8 transition-colors duration-300">Add New Product</h2><form onSubmit={submit} className="space-y-6"><AdminInput label="Product Name" name="name" /><AdminTextArea label="Description" name="description" /><div className="grid grid-cols-2 gap-6"><AdminInput label="Price ($)" name="price" type="number" step="0.01" /><AdminInput label="Stock Quantity" name="stock" type="number" /></div><div><label htmlFor="scent_family" className="block text-[0.65rem] uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 transition-colors duration-300">Scent Family</label><select name="scent_family" id="scent_family" className="block w-full px-3 py-2 border border-[#E5E5E5] dark:border-gray-800 bg-[#F8F5F0] dark:bg-[#121212] text-sm text-[#121212] dark:text-[#F8F5F0] focus:outline-none focus:border-[#121212] dark:focus:border-[#F8F5F0] transition-colors duration-300"><option value="Floral">Floral</option><option value="Woody">Woody</option><option value="Citrus">Citrus</option><option value="Earthy">Earthy</option></select></div><div className="space-y-4 border-t border-[#E5E5E5] dark:border-gray-800 pt-6 transition-colors duration-300"><label className="block text-[0.65rem] uppercase tracking-widest text-gray-500 dark:text-gray-400 transition-colors duration-300">Scent Profile</label><AdminBareInput name="scent_top" placeholder="Top Note" /><AdminBareInput name="scent_mid" placeholder="Middle Note" /><AdminBareInput name="scent_base" placeholder="Base Note" /></div><AdminInput label="Burn Time" name="burn_time" placeholder="e.g. 40-50 hours" /><AdminInput label="Image URL (Optional)" name="image_url" required={false} /><button type="submit" className="w-full btn-primary py-4 text-xs uppercase tracking-[0.2em] mt-8 dark:bg-[#F8F5F0] dark:text-[#121212] dark:border-[#F8F5F0] dark:hover:bg-transparent dark:hover:text-[#F8F5F0]">Add Product</button></form></div></div>
        <div className="lg:col-span-7"><div className="bg-white dark:bg-[#1E1E1E] border border-[#E5E5E5] dark:border-gray-800 transition-colors duration-300"><div className="px-8 py-6 border-b border-[#E5E5E5] dark:border-gray-800 transition-colors duration-300"><h3 className="text-lg text-[#121212] dark:text-[#F8F5F0] brand-font tracking-wide transition-colors duration-300">Inventory</h3></div><ul className="divide-y divide-[#E5E5E5] dark:divide-gray-800 transition-colors duration-300">{products.length ? products.map((product) => <li key={product.id} className="px-8 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center mb-4 sm:mb-0"><div className="flex-shrink-0 h-16 w-12 bg-[#F8F5F0] dark:bg-[#2A2A2A] flex items-center justify-center overflow-hidden border border-[#E5E5E5] dark:border-gray-800 transition-colors duration-300">{product.image_url ? <img src={product.image_url} alt="" className="h-full w-full object-cover" /> : <span className="text-[0.5rem] uppercase tracking-widest text-gray-400">IMG</span>}</div><div className="ml-6"><p className="text-base text-[#121212] dark:text-[#F8F5F0] brand-font mb-1 transition-colors duration-300">{product.name}</p><p className="text-[0.65rem] text-gray-500 dark:text-gray-400 uppercase tracking-widest transition-colors duration-300">{product.scent_family} | Stock: {product.stock_quantity}</p></div></div><div className="text-sm text-[#121212] dark:text-[#F8F5F0] transition-colors duration-300">{currency(product.price)}</div></li>) : <li className="px-8 py-10 text-center text-gray-500 dark:text-gray-400 text-xs uppercase tracking-widest transition-colors duration-300">No products in inventory. Add one to get started.</li>}</ul></div></div>
      </div>
    </div>
  )
}

function Success({ actions }) {
  return <div className="min-h-[60vh] flex flex-col items-center justify-center py-20 px-4 sm:px-6 lg:px-8 text-center"><div className="bg-white dark:bg-[#1E1E1E] p-16 border border-[#E5E5E5] dark:border-gray-800 max-w-lg w-full transition-colors duration-300"><h2 className="text-4xl text-[#121212] dark:text-[#F8F5F0] brand-font mb-6 tracking-wide transition-colors duration-300">Thank You</h2><div className="w-12 h-[1px] bg-[#D9B38C] mx-auto mb-8"></div><p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-widest leading-loose mb-12 transition-colors duration-300">Your order has been confirmed. We are preparing your artisanal candles and will notify you when they ship.</p><Link to="/" actions={actions} className="btn-primary inline-block px-10 py-4 text-xs uppercase tracking-[0.2em] dark:bg-[#F8F5F0] dark:text-[#121212] dark:border-[#F8F5F0] dark:hover:bg-transparent dark:hover:text-[#F8F5F0]">Return to Collection</Link></div></div>
}

function ProductImage({ product, className, imageClass, fallbackClass }) {
  return <div className={className}>{product.image_url ? <img src={product.image_url} alt={product.name} className={imageClass} /> : <div className={fallbackClass}>Serein</div>}</div>
}

function Detail({ title, children }) {
  return <details className="group border-b border-[#E5E5E5] dark:border-gray-800 transition-colors duration-300"><summary className="flex justify-between items-center font-semibold cursor-pointer list-none py-6 text-xs uppercase tracking-widest text-[#121212] dark:text-[#F8F5F0] transition-colors duration-300"><span>{title}</span><span className="transition group-open:rotate-180"><ChevronIcon /></span></summary><div className="pb-6 text-xs tracking-wider text-gray-500 dark:text-gray-400 group-open:animate-fadeIn">{children}</div></details>
}

function Info({ label, value }) {
  return <div className="flex justify-between"><span className="uppercase">{label}</span><span className="text-[#121212] dark:text-[#F8F5F0] text-right">{value}</span></div>
}

function CartItem({ product, quantity, actions }) {
  return <li className="py-8 flex flex-col md:flex-row md:items-center"><div className="flex flex-1 md:col-span-3 items-center mb-6 md:mb-0"><ProductImage product={product} className="flex-shrink-0 w-24 h-32 bg-white dark:bg-[#1E1E1E] transition-colors duration-300" imageClass="w-full h-full object-cover" fallbackClass="w-full h-full bg-[#f0eae1] dark:bg-[#2A2A2A] flex items-center justify-center text-[#D9B38C] brand-font text-xs uppercase transition-colors duration-300" /><div className="ml-6 flex flex-col justify-center"><h3 className="text-lg text-[#121212] dark:text-[#F8F5F0] brand-font tracking-wide mb-1 transition-colors duration-300"><Link to={`/product/${product.id}`} actions={actions} className="hover:text-[#D9B38C] dark:hover:text-[#D9B38C] transition-colors">{product.name}</Link></h3><p className="text-[0.65rem] text-gray-500 dark:text-gray-400 uppercase tracking-widest transition-colors duration-300">{product.scent_family}</p></div></div><div className="flex justify-between items-center md:flex-1 md:grid md:grid-cols-3 md:gap-4 w-full"><div className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 md:text-center md:col-span-1 transition-colors duration-300"><span className="md:hidden">Qty: </span>{quantity}</div><div className="text-sm text-[#121212] dark:text-[#F8F5F0] md:text-right md:col-span-2 flex justify-between items-center w-full md:w-auto md:justify-end transition-colors duration-300"><span className="md:mr-8">{currency(product.price * quantity)}</span><button onClick={() => actions.removeFromCart(product.id)} className="text-[0.6rem] uppercase tracking-widest text-gray-400 dark:text-gray-500 hover:text-[#121212] dark:hover:text-[#F8F5F0] border-b border-transparent hover:border-[#121212] dark:hover:border-[#F8F5F0] transition-colors pb-0.5">Remove</button></div></div></li>
}

function OrderSummary({ total, actions }) {
  return <div className="bg-[#fcfbf9] dark:bg-[#121212] p-8 border border-[#E5E5E5] dark:border-gray-800 transition-colors duration-300"><h2 className="text-lg text-[#121212] dark:text-[#F8F5F0] brand-font tracking-wide mb-8 border-b border-[#E5E5E5] dark:border-gray-800 pb-4 transition-colors duration-300">Order Summary</h2><dl className="space-y-4 text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 transition-colors duration-300"><div className="flex items-center justify-between"><dt>Subtotal</dt><dd className="text-[#121212] dark:text-[#F8F5F0] transition-colors duration-300">{currency(total)}</dd></div><div className="flex items-center justify-between"><dt>Shipping</dt><dd className="text-[#121212] dark:text-[#F8F5F0] transition-colors duration-300">Calculated at checkout</dd></div><div className="flex items-center justify-between border-t border-[#E5E5E5] dark:border-gray-800 pt-6 mt-6 transition-colors duration-300"><dt className="text-sm font-bold text-[#121212] dark:text-[#F8F5F0] transition-colors duration-300">Total</dt><dd className="text-sm font-bold text-[#121212] dark:text-[#F8F5F0] transition-colors duration-300">{currency(total)}</dd></div></dl><div className="mt-10"><button onClick={actions.checkout} className="w-full btn-primary py-4 text-xs uppercase tracking-[0.2em] dark:bg-[#F8F5F0] dark:text-[#121212] dark:border-[#F8F5F0] dark:hover:bg-transparent dark:hover:text-[#F8F5F0]">Checkout Securely</button></div><div className="mt-6 text-center"><Link to="/" actions={actions} className="text-[0.65rem] uppercase tracking-widest text-gray-500 dark:text-gray-400 border-b border-gray-300 dark:border-gray-600 hover:text-[#121212] dark:hover:text-[#F8F5F0] hover:border-[#121212] dark:hover:border-[#F8F5F0] transition-colors pb-1">Continue Shopping</Link></div></div>
}

function Footer() {
  return <footer className="bg-[#F8F5F0] dark:bg-[#0a0a0a] border-t border-[#E5E5E5] dark:border-gray-800 mt-20 transition-colors duration-300"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center justify-center text-center"><h2 className="text-2xl brand-font tracking-widest uppercase text-[#121212] dark:text-[#F8F5F0] mb-6">Serein</h2><div className="flex space-x-6 text-xs uppercase tracking-widest text-gray-500 mb-8"><a href="#" className="hover:text-[#121212] dark:hover:text-[#F8F5F0] transition-colors">About Us</a><a href="#" className="hover:text-[#121212] dark:hover:text-[#F8F5F0] transition-colors">Contact</a><a href="#" className="hover:text-[#121212] dark:hover:text-[#F8F5F0] transition-colors">Terms</a></div><p className="text-gray-400 text-xs tracking-wider">&copy; 2026 Serein. All rights reserved.</p></div></footer>
}

function Input({ name, type = 'text', placeholder }) {
  return <div><label htmlFor={name} className="sr-only">{placeholder}</label><input id={name} name={name} type={type} required className="appearance-none block w-full px-4 py-3 border border-[#E5E5E5] dark:border-gray-800 placeholder-gray-400 dark:placeholder-gray-500 text-[#121212] dark:text-[#F8F5F0] focus:outline-none focus:border-[#121212] dark:focus:border-[#F8F5F0] focus:ring-0 text-sm tracking-widest bg-[#F8F5F0] dark:bg-[#121212] transition-colors duration-300" placeholder={placeholder} /></div>
}

function AdminInput({ label, name, type = 'text', step, placeholder, required = true }) {
  return <div><label htmlFor={name} className="block text-[0.65rem] uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 transition-colors duration-300">{label}</label><input type={type} step={step} name={name} id={name} required={required} placeholder={placeholder} className="block w-full px-3 py-2 border border-[#E5E5E5] dark:border-gray-800 bg-[#F8F5F0] dark:bg-[#121212] text-sm text-[#121212] dark:text-[#F8F5F0] focus:outline-none focus:border-[#121212] dark:focus:border-[#F8F5F0] transition-colors duration-300" /></div>
}

function AdminTextArea({ label, name }) {
  return <div><label htmlFor={name} className="block text-[0.65rem] uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 transition-colors duration-300">{label}</label><textarea name={name} id={name} rows="3" required className="block w-full px-3 py-2 border border-[#E5E5E5] dark:border-gray-800 bg-[#F8F5F0] dark:bg-[#121212] text-sm text-[#121212] dark:text-[#F8F5F0] focus:outline-none focus:border-[#121212] dark:focus:border-[#F8F5F0] transition-colors duration-300"></textarea></div>
}

function AdminBareInput({ name, placeholder }) {
  return <div><input type="text" name={name} placeholder={placeholder} className="block w-full px-3 py-2 border border-[#E5E5E5] dark:border-gray-800 bg-[#F8F5F0] dark:bg-[#121212] text-sm text-[#121212] dark:text-[#F8F5F0] focus:outline-none focus:border-[#121212] dark:focus:border-[#F8F5F0] transition-colors duration-300" /></div>
}

function Divider() {
  return <div className="mt-8 mb-8 flex items-center justify-between"><div className="w-full border-t border-[#E5E5E5] dark:border-gray-800"></div><span className="px-4 text-[0.65rem] uppercase tracking-widest text-gray-400 dark:text-gray-500 bg-white dark:bg-[#1E1E1E]">OR</span><div className="w-full border-t border-[#E5E5E5] dark:border-gray-800"></div></div>
}

function TrustBadges() {
  return <div className="mt-8 grid grid-cols-3 gap-4 text-center border-t border-[#E5E5E5] dark:border-gray-800 pt-8 transition-colors duration-300"><Badge icon={<SunIcon />} text="100% Soy Wax" /><Badge icon={<PaletteIcon />} text="Hand-Poured" /><Badge icon={<HeartIcon />} text="Cruelty-Free" /></div>
}

function Badge({ icon, text }) {
  return <div className="flex flex-col items-center"><span className="w-6 h-6 mb-2 text-[#121212] dark:text-[#F8F5F0]">{icon}</span><span className="text-[0.55rem] uppercase tracking-widest text-gray-500 dark:text-gray-400">{text}</span></div>
}

function SunIcon() { return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg> }
function MoonIcon() { return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg> }
function UserIcon() { return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> }
function BagIcon() { return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg> }
function ChevronIcon() { return <svg fill="none" height="24" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg> }
function PaletteIcon() { return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"></path></svg> }
function HeartIcon() { return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg> }
function GoogleIcon() { return <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg> }

createRoot(document.getElementById('root')).render(<App />)
