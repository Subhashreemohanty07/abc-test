
import { Link } from "react-router-dom";

function Footer({ showSocial = true })  {
  return (
    <>
      {/* SOCIAL MEDIA SECTION */}
      {showSocial && (
      <section className="social-section container-fluid text-center">
        <h2>COME SAY HI TO US</h2>

        <div className="social-icons d-flex justify-content-center align-items-center flex-wrap gap-4">

          <a
            href="https://www.facebook.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="social-circle"
            aria-label="Facebook"
          >
            <i className="bi bi-facebook"></i>
          </a>

          <a
            href="https://www.instagram.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="social-circle"
            aria-label="Instagram"
          >
            <i className="bi bi-instagram"></i>
          </a>

          <a
            href="https://www.youtube.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="social-circle"
            aria-label="YouTube"
          >
            <i className="bi bi-youtube"></i>
          </a>

          <a
            href="https://x.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="social-circle"
            aria-label="X"
          >
            <i className="bi bi-twitter-x"></i>
          </a>

        </div>
      </section>
      )}

      {/* FOOTER */}
      <footer className="nykaa-footer" id="help">

        {/* FOOTER TOP */}
        <div className="footer-top row g-4 text-center">

          {/* SHOP WITH SABKOO */}
          <div className="col-12 col-md-4 footer-feature">
            <i className="bi bi-bag-check footer-feature-icon"></i>

            <h5>Shop with Sabkoo</h5>

            <p>Discover fashion for every occasion</p>

            <Link to="/products">
              Explore Products
            </Link>
          </div>

          {/* BECOME A SELLER */}
          <div className="col-12 col-md-4 footer-feature">
            <i className="bi bi-shop footer-feature-icon"></i>

            <h5>Become a Seller</h5>

            <p>Grow your business with Sabkoo</p>

            <Link to="/signup">
              Start Selling
            </Link>
          </div>

          {/* MANAGE ORDERS */}
          <div className="col-12 col-md-4 footer-feature">
            <i className="bi bi-box-seam footer-feature-icon"></i>

            <h5>Manage Your Orders</h5>

            <p>View and track your purchases</p>

            <Link to="/orders">
              My Orders
            </Link>
          </div>

        </div>

        {/* FOOTER BOTTOM */}
        <div className="footer-bottom row g-4">

          {/* SABKOO BRAND */}
          <div className="footer-brand col-12 col-md-6 col-lg-3">
            <h2>
              <Link to="/" className="footer-brand-name">
                Sabkoo
              </Link>
            </h2>

            <p>Marketplace for Community</p>

            <p>Fashion for Everyone.</p>

            <p>Everything in One Marketplace.</p>
          </div>

          {/* HELP */}
          <div className="col-6 col-md-6 col-lg-3">
            <h5>Help</h5>

            <p>Contact Us</p>

            <p>Frequently Asked Questions</p>

            <Link to="/orders">Track Your Order</Link>

            <p>Cancellation & Return</p>

            <p>Shipping & Delivery</p>

            <Link to="/signup">Sell on Sabkoo</Link>
          </div>

          {/* QUICK LINKS */}
          <div className="col-6 col-md-6 col-lg-3">
            <h5>Quick Links</h5>

            <Link to="/products">
              All Products
            </Link>

            <Link to="/products?sort=newest">
              New Arrivals
            </Link>

            <Link to="/#offers">
              Offer Zone
            </Link>

            <Link to="/products?category=women">
              Women's Fashion
            </Link>

            <Link to="/products?category=men">
              Men's Fashion
            </Link>
          </div>

          {/* TOP CATEGORIES */}
          <div className="col-6 col-md-6 col-lg-3">
            <h5>Top Categories</h5>

            <p>Sarees</p>
            <p>Kurtas & Kurtis</p>
            <p>Lehengas</p>
            <p>Dresses</p>
            <p>T-Shirts</p>
            <p>Shirts</p>
            <p>Jeans</p>
            <p>Ethnic Wear</p>
          </div>

        </div>

        {/* COPYRIGHT */}
        <div className="copyright">
          © {new Date().getFullYear()} Sabkoo.
          All rights reserved.
        </div>

      </footer>
    </>
  );
}

export default Footer;
