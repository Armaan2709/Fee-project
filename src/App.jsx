import React, { useEffect, useMemo, useState } from 'react';
import { PRODUCTS } from './data';
import { supabase } from './supabaseClient';

function App() {
  const [view, setView] = useState('home');
  const [currentUser, setCurrentUser] = useState(null);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [wishlist, setWishlist] = useState([]);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [quickviewProduct, setQuickviewProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [priceFilter, setPriceFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortFilter, setSortFilter] = useState('default');
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const savedWishlist = localStorage.getItem('wishlist');
    if (savedWishlist) {
      try {
        setWishlist(JSON.parse(savedWishlist));
      } catch {
        setWishlist([]);
      }
    }

    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch {
        setCurrentUser(null);
      }
    }

    const savedOrders = localStorage.getItem('orders');
    if (savedOrders) {
      try {
        setOrders(JSON.parse(savedOrders));
      } catch {
        setOrders([]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    localStorage.setItem('orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    const load = async () => {
      if (!currentUser) {
        setOrders([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading orders from Supabase', error);
          return;
        }

        const mapped = (data || []).map((row) => ({
          id: row.payment_id || row.id,
          total: row.total,
          items: row.items || [],
          createdAt: row.created_at,
        }));
        setOrders(mapped);
      } catch (err) {
        console.error('Unexpected error loading orders', err);
      }
    };

    load();
  }, [currentUser]);

  const showNotification = (message) => {
    const el = document.createElement('div');
    el.className = 'notification info';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  };

  const cartCount = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart]
  );

  const cartTotal = useMemo(
    () => cart.reduce((acc, item) => acc + item.price * item.quantity, 0),
    [cart]
  );

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((p) => p.id === product.id);
      if (existing) {
        return prev.map((p) =>
          p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    showNotification('Item added to cart!');
  };

  const updateCartQuantity = (id, newQty) => {
    setCart((prev) => {
      if (newQty <= 0) return prev.filter((p) => p.id !== id);
      return prev.map((p) => (p.id === id ? { ...p, quantity: newQty } : p));
    });
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((p) => p.id !== id));
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleCheckout = async () => {
    if (!cart.length) {
      alert('Your cart is empty.');
      return;
    }

    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      alert('Failed to load Razorpay. Please check your connection.');
      return;
    }

    const amountInPaise = Math.round(cartTotal * 100);

    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY, // Razorpay key from environment
      amount: amountInPaise.toString(),
      currency: 'INR',
      name: 'Nike Shoes Store',
      description: 'Order payment',
      handler: async function (response) {
        const newOrder = {
          id: response.razorpay_payment_id,
          total: cartTotal,
          items: cart,
          createdAt: new Date().toISOString(),
        };

        // Save in local state
        setOrders((prev) => [...prev, newOrder]);

        // Persist to Supabase for this user
        try {
          if (currentUser) {
            const { error } = await supabase.from('orders').insert({
              user_id: currentUser.id,
              email: currentUser.email,
              total: newOrder.total,
              items: newOrder.items,
              payment_id: newOrder.id,
            });
            if (error) {
              console.error('Error saving order to Supabase', error);
            }
          }
        } catch (err) {
          console.error('Unexpected error saving order to Supabase', err);
        }

        alert('Payment successful! Payment ID: ' + response.razorpay_payment_id);
        setCart([]);
        setIsCartOpen(false);
        setView('dashboard');
      },
      prefill: {
        name: currentUser?.fullname || 'Guest',
        email: currentUser?.email || '',
      },
      theme: {
        color: '#e91e63',
      },
    };

    const razorpay = new window.Razorpay(options);
    razorpay.open();
  };

  const wishlistCount = wishlist.length;
  const isInWishlist = (id) => wishlist.some((p) => p.id === id);

  const toggleWishlist = (product) => {
    setWishlist((prev) => {
      if (prev.some((p) => p.id === product.id)) {
        showNotification('Removed from wishlist');
        return prev.filter((p) => p.id !== product.id);
      }
      showNotification('Added to wishlist');
      return [...prev, product];
    });
  };

  const clearWishlist = () => {
    setWishlist([]);
    showNotification('Wishlist cleared');
  };

  const filteredProducts = useMemo(() => {
    let list = [...PRODUCTS];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(term));
    }

    if (categoryFilter !== 'all') {
      list = list.filter((p) => p.category === categoryFilter);
    }

    list = list.filter((p) => {
      const price = p.price;
      switch (priceFilter) {
        case '0-200':
          return price < 200;
        case '200-300':
          return price >= 200 && price < 300;
        case '300-400':
          return price >= 300 && price < 400;
        case '400+':
          return price >= 400;
        default:
          return true;
      }
    });

    switch (sortFilter) {
      case 'price-low':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        list.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        break;
    }

    return list;
  }, [searchTerm, priceFilter, categoryFilter, sortFilter]);

  const clearAllFilters = () => {
    setSearchTerm('');
    setPriceFilter('all');
    setCategoryFilter('all');
    setSortFilter('default');
  };

  const openQuickview = (product) => {
    setQuickviewProduct(product);
    document.body.style.overflow = 'hidden';
  };

  const closeQuickview = () => {
    setQuickviewProduct(null);
    document.body.style.overflow = 'auto';
  };

  const handleSignup = async ({ fullname, email, password, confirmPassword }) => {
    if (!fullname || !email || !password || !confirmPassword) {
      alert('Please fill out all fields.');
      return;
    }
    if (password !== confirmPassword) {
      alert('Passwords do not match.');
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { fullname },
        },
      });

      if (error) {
        alert(error.message || 'Sign up failed.');
        return;
      }

      alert('Account created successfully! Please sign in.');
      setView('login');
    } catch (err) {
      console.error('Supabase signup error', err);
      alert('Unexpected error while signing up.');
    }
  };

  const handleLogin = async ({ email, password }) => {
    if (!email || !password) {
      alert('Please enter both email and password.');
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        alert(error.message || 'Login failed.');
        return;
      }

      const user = data.user;
      const userInfo = {
        id: user.id,
        email: user.email,
        fullname: user.user_metadata?.fullname || user.email,
      };

      alert(`Login successful! Welcome back, ${userInfo.fullname}.`);
      setCurrentUser(userInfo);
      sessionStorage.setItem('currentUser', JSON.stringify(userInfo));
      setView('home');
    } catch (err) {
      console.error('Supabase login error', err);
      alert('Unexpected error while logging in.');
    }
  };

  const logout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('currentUser');
  };

  if (view === 'login') {
    return (
      <AuthLayout
        title="Welcome"
        subtitle="Back"
        switchText="Don't have an account?"
        switchLabel="Sign Up"
        onSwitch={() => setView('signup')}
      >
        <LoginForm onSubmit={handleLogin} />
      </AuthLayout>
    );
  }

  if (view === 'signup') {
    return (
      <AuthLayout
        title="Join Us"
        subtitle="Create Your Account"
        switchText="Already have an account?"
        switchLabel="Sign In"
        onSwitch={() => setView('login')}
      >
        <SignupForm onSubmit={handleSignup} />
      </AuthLayout>
    );
  }

  const isDashboard = view === 'dashboard';

  const arrivalProducts = filteredProducts.filter((p) => p.section === 'arrival');
  const collectionProducts = filteredProducts.filter((p) => p.section === 'collection');

  const goToSection = (id) => {
    setView('home');
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 0);
  };

  return (
    <>
      <Header
        cartCount={cartCount}
        wishlistCount={wishlistCount}
        onCartClick={() => {
          setIsCartOpen(true);
          document.body.style.overflow = 'hidden';
        }}
        onWishlistClick={() => {
          setIsWishlistOpen(true);
          document.body.style.overflow = 'hidden';
        }}
        onLoginClick={() => setView('login')}
        currentUser={currentUser}
        onLogout={logout}
        onDashboardClick={() => setView('dashboard')}
        onGoToSection={goToSection}
      />

      {isDashboard ? (
        <Dashboard orders={orders} onBackToShop={() => setView('home')} />
      ) : (
        <>
          <div className="search-container">
            <div className="search-bar">
              <input
                type="text"
                id="searchInput"
                placeholder="Search for shoes, brands, styles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button className="search-btn" id="searchBtn">
                <i className="fa-solid fa-magnifying-glass" />
              </button>
            </div>
            <div className="search-filters">
              <div className="filter-group">
                <label>Price Range:</label>
                <select
                  id="priceFilter"
                  value={priceFilter}
                  onChange={(e) => setPriceFilter(e.target.value)}
                >
                  <option value="all">All Prices</option>
                  <option value="0-200">Under $200</option>
                  <option value="200-300">$200 - $300</option>
                  <option value="300-400">$300 - $400</option>
                  <option value="400+">$400+</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Category:</label>
                <select
                  id="categoryFilter"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  <option value="men">Men</option>
                  <option value="women">Women</option>
                  <option value="sports">Sports</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Sort by:</label>
                <select
                  id="sortFilter"
                  value={sortFilter}
                  onChange={(e) => setSortFilter(e.target.value)}
                >
                  <option value="default">Default</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="rating">Highest Rated</option>
                  <option value="newest">Newest</option>
                </select>
              </div>
              <button className="clear-filters" id="clearFilters" onClick={clearAllFilters}>
                Clear Filters
              </button>
            </div>
          </div>

          <main className="hero container">
            <div className="clr-one" />
            <div className="clr-two" />
            <div className="wrapper">
              <div className="col col-text">
                <h1 className="heading-one">
                  best in style <br />
                  collection <br /> <span>for you</span>
                </h1>
                <p className="sub-text">
                  we craft, we want To Say The Best,
                  <br /> But Through 70 Years Of Experience In The Industry
                </p>
                <button className="btn btn-hero">pre-order now</button>
              </div>
              <div className="col col-img">
                <figure>
                  <img src="/img/hero.png" alt="nike-shoe" />
                </figure>
                <div className="hero-img-off">
                  <h3>get up to 50% OFF</h3>
                  <p>
                    Lorem ipsum, dolor sit amet consectetur adipisicing elit. Nam, ad.
                  </p>
                </div>
              </div>
            </div>
          </main>

          <section className="arrival container" id="arrival">
            <div className="section-heading">
              <div className="heading">
                <p className="sub-heading">our new collection</p>
                <h2 className="heading-two">
                  new <span>arrivals</span>
                </h2>
              </div>
              <button className="btn">see all</button>
            </div>
            <div className="wrapper">
              {arrivalProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onAddToCart={() => addToCart(p)}
                  onToggleWishlist={() => toggleWishlist(p)}
                  onQuickview={() => openQuickview(p)}
                  inWishlist={isInWishlist(p.id)}
                />
              ))}
            </div>
          </section>

          <section className="about container" id="about">
            <div className="clr-one" />
            <div className="clr-two" />
            <div className="wrapper">
              <div className="col-img col">
                <div className="get-off">
                  <h4>get up to 50% OFF</h4>
                  <p className="off-text">
                    Lorem ipsum, dolor sit amet consectetur adipisicing elit. Cupiditate, iusto.
                  </p>
                </div>
                <figure>
                  <img src="/img/about6.png" alt="about-img" />
                </figure>
              </div>
              <div className="col-text col">
                <p className="sub-heading">about us</p>
                <h2 className="heading-two">
                  {' '}
                  We provide high <br /> quality <span> shoes</span>
                </h2>
                <p className="about-text">
                  Lorem, ipsum dolor sit amet consectetur adipisicing elit. Numquam quibusdam earum enim non iusto
                  officia veniam voluptas, nihil quia ea!
                </p>
                <button className="btn">read more</button>
              </div>
            </div>
          </section>

          <section className="collection container" id="best-collection">
            <div className="section-heading">
              <div className="heading">
                <p className="sub-heading">best collection</p>
                <h2 className="heading-two">our new collection</h2>
              </div>
              <div className="btn-section">
                <button
                  className={`btn-col ${categoryFilter === 'all' ? 'btn' : ''}`}
                  onClick={() => setCategoryFilter('all')}
                >
                  all
                </button>
                <button
                  className={`btn-col ${categoryFilter === 'men' ? 'btn' : ''}`}
                  onClick={() => setCategoryFilter('men')}
                >
                  men
                </button>
                <button
                  className={`btn-col ${categoryFilter === 'women' ? 'btn' : ''}`}
                  onClick={() => setCategoryFilter('women')}
                >
                  women
                </button>
                <button
                  className={`btn-col ${categoryFilter === 'sports' ? 'btn' : ''}`}
                  onClick={() => setCategoryFilter('sports')}
                >
                  sports
                </button>
              </div>
            </div>
            <div className="grid-wrapper">
              {collectionProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onAddToCart={() => addToCart(p)}
                  onToggleWishlist={() => toggleWishlist(p)}
                  onQuickview={() => openQuickview(p)}
                  inWishlist={isInWishlist(p.id)}
                  isCollection
                />
              ))}
            </div>
          </section>

          <section className="subscribe container">
            <div className="wrapper">
              <h2 className="heading-two">subscribe for news and latest updates</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  alert('Subscribed!');
                }}
              >
                <input type="email" className="email" placeholder="example@gmail.com" required />
                <button className="btn" type="submit">
                  subscribe
                </button>
              </form>
            </div>
          </section>

          <footer className="container">
            <div className="wrapper">
              <div className="col">
                <a href="#home" className="logo">
                  Nike
                </a>
                <p className="about-website">
                  Lorem ipsum dolor, sit amet consectetur <br /> adipisicing elit. Doloribus, <br /> alias! Lorem ipsum dolor
                  sit amet.
                </p>
              </div>
              <div className="col">
                <h4>quick links</h4>
                <a href="#home">Home</a>
                <a href="#about">About</a>
                <a href="#arrival">new arrivals</a>
                <a href="#best-collection">best collection</a>
              </div>
              <div className="col">
                <h4>contact us</h4>
                <p>Ksp@nike.com</p>
                <p>311-222-3333</p>
              </div>
            </div>
          </footer>
        </>
      )}

      <CartModal
        isOpen={isCartOpen}
        onClose={() => {
          setIsCartOpen(false);
          document.body.style.overflow = 'auto';
        }}
        cart={cart}
        total={cartTotal}
        onUpdateQty={updateCartQuantity}
        onRemove={removeFromCart}
        onCheckout={handleCheckout}
      />

      <WishlistModal
        isOpen={isWishlistOpen}
        onClose={() => {
          setIsWishlistOpen(false);
          document.body.style.overflow = 'auto';
        }}
        wishlist={wishlist}
        onAddToCart={addToCart}
        onRemove={(id) => setWishlist((prev) => prev.filter((p) => p.id !== id))}
        onClear={clearWishlist}
      />

      {quickviewProduct && (
        <QuickviewModal
          product={quickviewProduct}
          onClose={closeQuickview}
          onAddToCart={() => {
            addToCart(quickviewProduct);
            closeQuickview();
          }}
          onToggleWishlist={() => toggleWishlist(quickviewProduct)}
          inWishlist={isInWishlist(quickviewProduct.id)}
        />
      )}
    </>
  );
}

function Header({ cartCount, wishlistCount, onCartClick, onWishlistClick, onLoginClick, currentUser, onLogout, onDashboardClick, onGoToSection }) {
  return (
    <header className="header" id="home">
      <div className="nav">
        <a href="#home" className="logo">
          Nike
        </a>
        <nav>
          <ul>
            <li>
              <a
                href="#home"
                onClick={(e) => {
                  e.preventDefault();
                  onGoToSection && onGoToSection('home');
                }}
              >
                Home
              </a>
            </li>
            <li>
              <a
                href="#arrival"
                onClick={(e) => {
                  e.preventDefault();
                  onGoToSection && onGoToSection('arrival');
                }}
              >
                New Arrivals
              </a>
            </li>
            <li>
              <a
                href="#best-collection"
                onClick={(e) => {
                  e.preventDefault();
                  onGoToSection && onGoToSection('best-collection');
                }}
              >
                Best Collection
              </a>
            </li>
            <li>
              <a
                href="#about"
                onClick={(e) => {
                  e.preventDefault();
                  onGoToSection && onGoToSection('about');
                }}
              >
                about
              </a>
            </li>
            {currentUser && (
              <li>
                <button className="btn" style={{ padding: '4px 8px' }} onClick={onDashboardClick}>
                  My Orders
                </button>
              </li>
            )}
            <li>
              {currentUser ? (
                <button className="btn" style={{ padding: '4px 8px' }} onClick={onLogout}>
                  Logout ({currentUser.fullname})
                </button>
              ) : (
                <button className="btn" style={{ padding: '4px 8px' }} onClick={onLoginClick}>
                  Sign-in
                </button>
              )}
            </li>
          </ul>
          <div className="nav-icon">
            <span className="wishlist-icon" onClick={onWishlistClick}>
              <i className="fa-solid fa-heart" />
              <span className="wishlist-count">{wishlistCount}</span>
            </span>
            <span className="cart-icon" onClick={onCartClick}>
              <i className="fa-solid fa-cart-shopping" />
              <span className="cart-count">{cartCount}</span>
            </span>
          </div>
        </nav>
      </div>
    </header>
  );
}

function ProductCard({ product, onAddToCart, onToggleWishlist, onQuickview, inWishlist, isCollection }) {
  return (
    <div className={`col ${isCollection ? 'collection-item' : ''}`} data-item={product.category}>
      <figure>
        <img src={product.image} alt={product.name} />
        <div className="product-actions">
          <button className="action-btn wishlist-btn" onClick={onToggleWishlist}>
            <i className={inWishlist ? 'fa-solid fa-heart' : 'fa-regular fa-heart'} />
          </button>
          <button className="action-btn quickview-btn" onClick={onQuickview}>
            <i className="fa-solid fa-eye" />
          </button>
        </div>
      </figure>
      <div className="col-body">
        <p className="rating-icon">
          <i className="fa-solid fa-star" /> <span className="rating-num">{product.rating.toFixed(1)}</span>
        </p>
        <h3 className="heading-three">{product.title}</h3>
        <p className="sub-heading">{product.subtitle}</p>
        <div className="col-footer">
          <p className="show-price">${product.price}</p>
          <button className="show-btn btn" onClick={onAddToCart}>
            add to cart
          </button>
        </div>
      </div>
    </div>
  );
}

function CartModal({ isOpen, onClose, cart, total, onUpdateQty, onRemove, onCheckout }) {
  if (!isOpen) return null;
  return (
    <div className="cart-modal">
      <div className="cart-overlay" onClick={onClose} />
      <div className="cart-sidebar">
        <div className="cart-header">
          <h3>Shopping Cart</h3>
          <button className="close-cart" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="cart-items">
          {cart.length === 0 ? (
            <p className="empty-cart">Your cart is empty</p>
          ) : (
            cart.map((item) => (
              <div className="cart-item" key={item.id}>
                <div className="cart-item-image">
                  <img src={item.image} alt={item.name} />
                </div>
                <div className="cart-item-details">
                  <h4>{item.name}</h4>
                  <p className="cart-item-price">${item.price.toFixed(2)}</p>
                  <div className="quantity-controls">
                    <button className="quantity-btn" onClick={() => onUpdateQty(item.id, item.quantity - 1)}>
                      -
                    </button>
                    <span className="quantity">{item.quantity}</span>
                    <button className="quantity-btn" onClick={() => onUpdateQty(item.id, item.quantity + 1)}>
                      +
                    </button>
                  </div>
                </div>
                <button className="remove-item" onClick={() => onRemove(item.id)}>
                  <i className="fa-solid fa-trash" />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="cart-footer">
          <div className="cart-total">
            <h4>Total: ${total.toFixed(2)}</h4>
          </div>
          <button className="btn checkout-btn" onClick={onCheckout}>
            Checkout
          </button>
        </div>
      </div>
    </div>
  );
}

function WishlistModal({ isOpen, onClose, wishlist, onAddToCart, onRemove, onClear }) {
  if (!isOpen) return null;
  return (
    <div className="wishlist-modal">
      <div className="wishlist-overlay" onClick={onClose} />
      <div className="wishlist-sidebar">
        <div className="wishlist-header">
          <h3>My Wishlist</h3>
          <button className="close-wishlist" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="wishlist-items">
          {wishlist.length === 0 ? (
            <p className="empty-wishlist">Your wishlist is empty</p>
          ) : (
            wishlist.map((item) => (
              <div className="wishlist-item" key={item.id}>
                <div className="wishlist-item-image">
                  <img src={item.image} alt={item.name} />
                </div>
                <div className="wishlist-item-details">
                  <h4>{item.name}</h4>
                  <p className="wishlist-item-price">${item.price.toFixed(2)}</p>
                  <p className="wishlist-item-category">{item.category}</p>
                </div>
                <div className="wishlist-item-actions">
                  <button className="btn add-to-cart-from-wishlist" onClick={() => onAddToCart(item)}>
                    <i className="fa-solid fa-cart-shopping" />
                  </button>
                  <button className="remove-wishlist-item" onClick={() => onRemove(item.id)}>
                    <i className="fa-solid fa-trash" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="wishlist-footer">
          <button className="btn clear-wishlist" onClick={onClear}>
            Clear Wishlist
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickviewModal({ product, onClose, onAddToCart, onToggleWishlist, inWishlist }) {
  const rating = product.rating ?? 4.5;

  const stars = [];
  const full = Math.floor(rating);
  const half = rating % 1 !== 0;
  for (let i = 0; i < full; i++) stars.push('full');
  if (half) stars.push('half');
  while (stars.length < 5) stars.push('empty');

  return (
    <div className="quickview-modal">
      <div className="quickview-overlay" onClick={onClose} />
      <div className="quickview-content">
        <button className="close-quickview" onClick={onClose}>
          <i className="fa-solid fa-xmark" />
        </button>
        <div className="quickview-wrapper">
          <div className="quickview-images">
            <div className="main-image">
              <img src={product.image} alt={product.name} />
            </div>
          </div>
          <div className="quickview-details">
            <h2>{product.name}</h2>
            <div className="quickview-rating">
              <div className="stars">
                {stars.map((type, idx) => {
                  if (type === 'full') return <i key={idx} className="fa-solid fa-star" />;
                  if (type === 'half') return <i key={idx} className="fa-solid fa-star-half-stroke" />;
                  return <i key={idx} className="fa-regular fa-star" />;
                })}
              </div>
              <span>{rating.toFixed(1)}</span>
            </div>
            <p className="quickview-price">${product.price.toFixed(2)}</p>
            <p className="quickview-description">
              Premium {product.category} shoes with excellent comfort and style. Perfect for everyday wear and special
              occasions.
            </p>
            <div className="quickview-actions">
              <button className="btn add-to-cart-quickview" onClick={onAddToCart}>
                <i className="fa-solid fa-cart-shopping" /> Add to Cart
              </button>
              <button className="btn add-to-wishlist-quickview" onClick={onToggleWishlist}>
                <i className="fa-solid fa-heart" /> {inWishlist ? 'In Wishlist' : 'Add to Wishlist'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthLayout({ title, subtitle, switchText, switchLabel, onSwitch, children }) {
  return (
    <div className="auth-page">
      <header className="header">
        <div className="logo">NIKE</div>
      </header>
      <main className="main-content">
        <div className="login-container">
          <div className="login-header">
            <h1 className="login-title">{title}</h1>
            <p className="login-subtitle">{subtitle}</p>
          </div>
          {children}
          <div className="divider">
            <span>or</span>
          </div>
          <div className="signup-link">
            {switchText}{' '}
            <button
              type="button"
              style={{ color: '#e91e63', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={onSwitch}
            >
              {switchLabel}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function LoginForm({ onSubmit }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ email, password });
      }}
    >
      <div className="form-group">
        <label className="form-label">Email Address</label>
        <input
          type="email"
          className="form-input"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="form-group">
        <label className="form-label">Password</label>
        <input
          type="password"
          className="form-input"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <div className="forgot-password">
        <a href="#forgot">Forgot Password?</a>
      </div>
      <button type="submit" className="login-button">
        Sign In
      </button>
    </form>
  );
}

function SignupForm({ onSubmit }) {
  const [fullname, setFullname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirm] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ fullname, email, password, confirmPassword });
      }}
    >
      <div className="form-group">
        <label className="form-label">Full Name</label>
        <input
          type="text"
          className="form-input"
          placeholder="Enter your full name"
          value={fullname}
          onChange={(e) => setFullname(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Email Address</label>
        <input
          type="email"
          className="form-input"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Password</label>
        <input
          type="password"
          className="form-input"
          placeholder="Create a strong password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Confirm Password</label>
        <input
          type="password"
          className="form-input"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <button type="submit" className="login-button">
        Sign Up
      </button>
    </form>
  );
}

function Dashboard({ orders, onBackToShop }) {
  return (
    <main className="container" style={{ marginTop: '120px' }}>
      <div className="wrapper" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <h2 className="heading-two">My Orders</h2>
        {!orders.length ? (
          <p style={{ color: '#fff', marginTop: '16px' }}>You have no orders yet.</p>
        ) : (
          <div
            style={{
              width: '100%',
              marginTop: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {orders
              .slice()
              .reverse()
              .map((order) => (
                <div
                  key={order.id}
                  style={{
                    borderRadius: '10px',
                    padding: '16px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <h3 className="heading-three">Order #{order.id}</h3>
                  <p style={{ color: '#dedede' }}>Total: ₹{order.total.toFixed(2)}</p>
                  <p style={{ color: '#dedede' }}>
                    Date: {new Date(order.createdAt).toLocaleString()}
                  </p>

                  <div
                    style={{
                      marginTop: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <img
                          src={item.image}
                          alt={item.name}
                          style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }}
                        />
                        <div style={{ color: '#dedede' }}>
                          <div>{item.name}</div>
                          <div style={{ fontSize: '0.85rem' }}>Qty: {item.quantity}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
        <button
          className="btn"
          style={{ marginTop: '24px', alignSelf: 'flex-start' }}
          onClick={onBackToShop}
        >
          Back to shopping
        </button>
      </div>
    </main>
  );
}

export default App;
