CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(255),
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL,
  created_at TIMESTAMP NOT NULL,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE brands (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  country VARCHAR(255),
  website VARCHAR(255),
  logo_url VARCHAR(255)
);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  parent_id INTEGER,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  FOREIGN KEY (parent_id) REFERENCES categories(id)
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL,
  brand_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL NOT NULL,
  stock INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL,
  created_at TIMESTAMP NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (brand_id) REFERENCES brands(id),
  FOREIGN KEY (seller_id) REFERENCES users(id)
);

CREATE TABLE product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  url VARCHAR(255) NOT NULL,
  is_main BOOLEAN NOT NULL,
  sort_order INTEGER NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE addresses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  label VARCHAR(255),
  city VARCHAR(255) NOT NULL,
  street VARCHAR(255) NOT NULL,
  zip VARCHAR(255) NOT NULL,
  is_default BOOLEAN NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE payment_methods (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  type VARCHAR(255) NOT NULL,
  provider VARCHAR(255),
  last_four VARCHAR(255),
  expires_at VARCHAR(255),
  is_default BOOLEAN NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  address_id INTEGER NOT NULL,
  status VARCHAR(255) NOT NULL,
  total_amount DECIMAL NOT NULL,
  discount_amount DECIMAL NOT NULL,
  created_at TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (address_id) REFERENCES addresses(id)
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  payment_method_id INTEGER NOT NULL,
  amount DECIMAL NOT NULL,
  status VARCHAR(255) NOT NULL,
  transaction_id VARCHAR(255),
  paid_at TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)
);

CREATE TABLE warehouses (
  id SERIAL PRIMARY KEY,
  manager_id INTEGER,
  name VARCHAR(255) NOT NULL,
  city VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL,
  capacity INTEGER NOT NULL,
  FOREIGN KEY (manager_id) REFERENCES users(id)
);

CREATE TABLE inventory (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  warehouse_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  reserved INTEGER NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
);

CREATE TABLE shipments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  warehouse_id INTEGER NOT NULL,
  courier_id INTEGER,
  tracking_number VARCHAR(255),
  status VARCHAR(255) NOT NULL,
  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (courier_id) REFERENCES users(id)
);

CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  rating SMALLINT NOT NULL,
  title VARCHAR(255),
  body TEXT,
  is_verified BOOLEAN NOT NULL,
  created_at TIMESTAMP NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  slug VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE product_tags (
  product_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (product_id, tag_id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);

CREATE TABLE discounts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(255) NOT NULL,
  value DECIMAL NOT NULL,
  min_order_amount DECIMAL,
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  is_active BOOLEAN NOT NULL
);

CREATE TABLE coupon_codes (
  id SERIAL PRIMARY KEY,
  discount_id INTEGER NOT NULL,
  code VARCHAR(255) NOT NULL UNIQUE,
  max_uses INTEGER,
  used_count INTEGER NOT NULL,
  FOREIGN KEY (discount_id) REFERENCES discounts(id)
);

CREATE TABLE cart (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE cart_items (
  id SERIAL PRIMARY KEY,
  cart_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  added_at TIMESTAMP NOT NULL,
  FOREIGN KEY (cart_id) REFERENCES cart(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE wishlist (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE wishlist_items (
  id SERIAL PRIMARY KEY,
  wishlist_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  added_at TIMESTAMP NOT NULL,
  FOREIGN KEY (wishlist_id) REFERENCES wishlist(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  country VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(255),
  rating DECIMAL
);

CREATE TABLE supplier_products (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  supply_price DECIMAL NOT NULL,
  min_order_qty INTEGER NOT NULL,
  lead_time_days INTEGER NOT NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  type VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL,
  created_at TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE support_tickets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  order_id INTEGER,
  assigned_to INTEGER,
  subject VARCHAR(255) NOT NULL,
  status VARCHAR(255) NOT NULL,
  priority VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  closed_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id)
);

CREATE TABLE ticket_messages (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMP NOT NULL,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id),
  FOREIGN KEY (sender_id) REFERENCES users(id)
);

CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(255) NOT NULL,
  entity_id INTEGER,
  old_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(255),
  created_at TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE product_attributes (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  value VARCHAR(255) NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

INSERT INTO roles (id, name, description) VALUES
(NULL, 'admin', 'Full system access'),
(NULL, 'manager', 'Manage products and orders'),
(NULL, 'seller', 'Manage own products'),
(NULL, 'customer', 'Buy products'),
(NULL, 'support', 'Handle support tickets'),
(NULL, 'analyst', 'Read-only analytics'),
(NULL, 'moderator', 'Moderate reviews and content'),
(NULL, 'courier', 'Delivery operations'),
(NULL, 'warehouse', 'Warehouse operations'),
(NULL, 'finance', 'Financial reports and payments');

INSERT INTO users (id, role_id, email, name, phone, password_hash, is_active, created_at) VALUES
(NULL, 1, 'admin@market.io', 'Алексей Смирнов', '+7-900-111-0001', 'hash_001', 'TRUE', NULL),
(NULL, 2, 'manager@market.io', 'Ольга Иванова', '+7-900-111-0002', 'hash_002', 'TRUE', NULL),
(NULL, 3, 'seller1@market.io', 'ИП Козлов Дмитрий', '+7-900-111-0003', 'hash_003', 'TRUE', NULL),
(NULL, 3, 'seller2@market.io', 'ИП Новикова Анна', '+7-900-111-0004', 'hash_004', 'TRUE', NULL),
(NULL, 4, 'user1@gmail.com', 'Петр Федоров', '+7-900-111-0005', 'hash_005', 'TRUE', NULL),
(NULL, 4, 'user2@gmail.com', 'Мария Соколова', '+7-900-111-0006', 'hash_006', 'TRUE', NULL),
(NULL, 4, 'user3@gmail.com', 'Иван Морозов', '+7-900-111-0007', 'hash_007', 'TRUE', NULL),
(NULL, 4, 'user4@gmail.com', 'Елена Волкова', '+7-900-111-0008', 'hash_008', 'TRUE', NULL),
(NULL, 5, 'support1@market.io', 'Сергей Лебедев', '+7-900-111-0009', 'hash_009', 'TRUE', NULL),
(NULL, 4, 'user5@gmail.com', 'Наталья Козлова', '+7-900-111-0010', 'hash_010', 'TRUE', NULL),
(NULL, 4, 'user6@gmail.com', 'Андрей Попов', '+7-900-111-0011', 'hash_011', 'TRUE', NULL),
(NULL, 8, 'courier1@market.io', 'Виктор Семенов', '+7-900-111-0012', 'hash_012', 'TRUE', NULL);

INSERT INTO brands (id, name, country, website, logo_url) VALUES
(NULL, 'TechPro', 'Россия', 'https://techpro.ru', NULL),
(NULL, 'HomeStyle', 'Россия', 'https://homestyle.ru', NULL),
(NULL, 'SportMax', 'Германия', 'https://sportmax.de', NULL),
(NULL, 'FoodNature', 'Франция', 'https://foodnature.fr', NULL),
(NULL, 'KidZone', 'Китай', 'https://kidzone.cn', NULL),
(NULL, 'ElectroWave', 'Южная Корея', 'https://electrowave.kr', NULL),
(NULL, 'GreenLife', 'Нидерланды', 'https://greenlife.nl', NULL),
(NULL, 'UrbanGear', 'США', 'https://urbangear.com', NULL),
(NULL, 'AquaPure', 'Германия', 'https://aquapure.de', NULL),
(NULL, 'SkyDrive', 'Япония', 'https://skydrive.jp', NULL),
(NULL, 'NordLight', 'Швеция', 'https://nordlight.se', NULL),
(NULL, 'AlfaTools', 'Россия', 'https://alfatools.ru', NULL);

INSERT INTO categories (id, parent_id, name, slug) VALUES
(NULL, NULL, 'Электроника', 'electronics'),
(NULL, NULL, 'Одежда и обувь', 'clothing'),
(NULL, NULL, 'Дом и сад', 'home-garden'),
(NULL, NULL, 'Спорт и туризм', 'sport'),
(NULL, NULL, 'Детские товары', 'kids'),
(NULL, NULL, 'Продукты питания', 'food'),
(NULL, 1, 'Смартфоны', 'smartphones'),
(NULL, 1, 'Ноутбуки', 'laptops'),
(NULL, 1, 'Наушники', 'headphones'),
(NULL, 2, 'Мужская одежда', 'mens-clothing'),
(NULL, 2, 'Женская одежда', 'womens-clothing'),
(NULL, 3, 'Мебель', 'furniture'),
(NULL, 3, 'Посуда', 'kitchenware'),
(NULL, 4, 'Велосипеды', 'bicycles'),
(NULL, 5, 'Игрушки', 'toys');

INSERT INTO products (id, category_id, brand_id, seller_id, name, description, price, stock, is_active, created_at) VALUES
(NULL, 7, 6, 3, 'Смартфон ElectroWave X12', NULL, 29990, 45, NULL, NULL),
(NULL, 7, 1, 3, 'Смартфон TechPro S5', NULL, 19990, 30, NULL, NULL),
(NULL, 8, 6, 4, 'Ноутбук ElectroWave Pro 15', NULL, 79990, 12, NULL, NULL),
(NULL, 8, 1, 4, 'Ноутбук TechPro Air', NULL, 54990, 20, NULL, NULL),
(NULL, 9, 6, 3, 'Наушники ElectroWave BT300', NULL, 5990, 80, NULL, NULL),
(NULL, 10, 8, 4, 'Футболка UrbanGear Classic', NULL, 990, 200, NULL, NULL),
(NULL, 11, 8, 3, 'Платье UrbanGear Summer', NULL, 2490, 60, NULL, NULL),
(NULL, 12, 2, 4, 'Диван HomeStyle Comfort 3-х местный', NULL, 49990, 5, NULL, NULL),
(NULL, 13, 2, 3, 'Набор посуды HomeStyle 12 предметов', NULL, 3990, 35, NULL, NULL),
(NULL, 14, 3, 4, 'Велосипед SportMax Trail 27.5', NULL, 24990, 8, NULL, NULL),
(NULL, 4, 3, 3, 'Рюкзак туристический SportMax 60L', NULL, 7990, 25, NULL, NULL),
(NULL, 15, 5, 4, 'Конструктор KidZone STEM 500 дет.', NULL, 2990, 50, NULL, NULL),
(NULL, 6, 4, 3, 'Кофе FoodNature Arabica 500г', NULL, 890, 150, NULL, NULL),
(NULL, 1, 6, 4, 'Умная колонка ElectroWave Mini', NULL, 4990, 40, NULL, NULL),
(NULL, 8, 10, 3, 'Планшет SkyDrive Tab Pro', NULL, 34990, 18, NULL, NULL);

INSERT INTO product_images (id, product_id, url, is_main, sort_order) VALUES
(NULL, 1, 'https://cdn.market.io/p1_main.jpg', 'TRUE', 0),
(NULL, 1, 'https://cdn.market.io/p1_side.jpg', 'FALSE', 1),
(NULL, 2, 'https://cdn.market.io/p2_main.jpg', 'TRUE', 0),
(NULL, 3, 'https://cdn.market.io/p3_main.jpg', 'TRUE', 0),
(NULL, 3, 'https://cdn.market.io/p3_open.jpg', 'FALSE', 1),
(NULL, 4, 'https://cdn.market.io/p4_main.jpg', 'TRUE', 0),
(NULL, 5, 'https://cdn.market.io/p5_main.jpg', 'TRUE', 0),
(NULL, 6, 'https://cdn.market.io/p6_main.jpg', 'TRUE', 0),
(NULL, 7, 'https://cdn.market.io/p7_main.jpg', 'TRUE', 0),
(NULL, 8, 'https://cdn.market.io/p8_main.jpg', 'TRUE', 0),
(NULL, 9, 'https://cdn.market.io/p9_main.jpg', 'TRUE', 0),
(NULL, 10, 'https://cdn.market.io/p10_main.jpg', 'TRUE', 0);

INSERT INTO addresses (id, user_id, label, city, street, zip, is_default) VALUES
(NULL, 5, 'Дом', 'Москва', '''''''''''''''''ул. Ленина 12', 'кв.5''''''''''''''''', '101000'),
(NULL, 5, 'Работа', 'Москва', '''''''''''''''''пр. Мира 88', 'оф.301''''''''''''''''', '129090'),
(NULL, 6, 'Дом', 'Санкт-Петербург', '''''''''''''''''Невский пр. 45', 'кв.12''''''''''''''''', '191011'),
(NULL, 7, 'Дом', 'Казань', '''''''''''''''''ул. Баумана 5', 'кв.8''''''''''''''''', '420111'),
(NULL, 8, 'Дом', 'Новосибирск', '''''''''''''''''Красный пр. 22', 'кв.14''''''''''''''''', '630099'),
(NULL, 8, 'Дача', 'Новосибирск', '''''''''''''''''СНТ Берёзка', 'уч.7''''''''''''''''', '630500'),
(NULL, 10, 'Дом', 'Екатеринбург', '''''''''''''''''ул. Вайнера 10', 'кв.3''''''''''''''''', '620014'),
(NULL, 11, 'Дом', 'Самара', '''''''''''''''''Московское ш. 15', 'кв.21''''''''''''''''', '443086'),
(NULL, 3, 'Склад', 'Москва', '''''''''''''''''Варшавское ш. 100', 'скл.5''''''''''''''''', '117405'),
(NULL, 4, 'Склад', 'Санкт-Петербург', '''''''''''''''''Пулковское ш. 40', 'скл.12''''''''''''''''', '196210');

INSERT INTO payment_methods (id, user_id, type, provider, last_four, expires_at, is_default) VALUES
(NULL, 5, 'card', 'Visa', '4242', '12/27', 'TRUE'),
(NULL, 5, 'sbp', 'СБП', NULL, NULL, 'FALSE'),
(NULL, 6, 'card', 'Mastercard', '5353', '08/26', 'TRUE'),
(NULL, 7, 'card', 'Mir', '2202', '03/28', 'TRUE'),
(NULL, 8, 'card', 'Visa', '1111', '11/25', 'TRUE'),
(NULL, 8, 'wallet', 'ЮMoney', NULL, NULL, 'FALSE'),
(NULL, 10, 'card', 'Mastercard', '9999', '06/27', 'TRUE'),
(NULL, 11, 'sbp', 'СБП', NULL, NULL, 'TRUE'),
(NULL, 11, 'card', 'Mir', '2200', '09/26', 'FALSE'),
(NULL, 3, 'card', 'Visa', '7777', '01/28', 'TRUE');

INSERT INTO orders (id, user_id, address_id, status, total_amount, discount_amount, created_at) VALUES
(NULL, 5, 1, 'delivered', 29990, 0, NULL),
(NULL, 5, 1, 'delivered', 5990, 500, NULL),
(NULL, 6, 3, 'delivered', 79990, 2000, NULL),
(NULL, 7, 4, 'shipped', 19990, 0, NULL),
(NULL, 7, 4, 'processing', 24990, 1000, NULL),
(NULL, 8, 5, 'new', 3980, 0, NULL),
(NULL, 8, 5, 'delivered', 49990, 5000, NULL),
(NULL, 10, 7, 'cancelled', 2990, 0, NULL),
(NULL, 10, 7, 'delivered', 7990, 0, NULL),
(NULL, 11, 8, 'shipped', 54990, 3000, NULL),
(NULL, 5, 2, 'processing', 890, 0, NULL),
(NULL, 6, 3, 'new', 34990, 0, NULL);

INSERT INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES
(NULL, 1, 1, 1, 29990),
(NULL, 2, 5, 1, 5990),
(NULL, 3, 3, 1, 79990),
(NULL, 4, 2, 1, 19990),
(NULL, 5, 10, 1, 24990),
(NULL, 6, 9, 1, 3990),
(NULL, 6, 13, 1, 890),
(NULL, 7, 8, 1, 49990),
(NULL, 8, 12, 1, 2990),
(NULL, 9, 11, 1, 7990),
(NULL, 10, 4, 1, 54990),
(NULL, 11, 13, 1, 890),
(NULL, 12, 15, 1, 34990);

INSERT INTO payments (id, order_id, payment_method_id, amount, status, transaction_id, paid_at) VALUES
(NULL, 1, 1, 29990, 'success', 'TXN-001', '2025-05-01 10:23:00'),
(NULL, 2, 1, 5490, 'success', 'TXN-002', '2025-05-03 14:10:00'),
(NULL, 3, 3, 77990, 'success', 'TXN-003', '2025-05-05 09:45:00'),
(NULL, 4, 4, 19990, 'success', 'TXN-004', '2025-05-10 16:30:00'),
(NULL, 5, 4, 23990, 'success', 'TXN-005', '2025-05-12 11:00:00'),
(NULL, 6, 5, 3980, 'pending', NULL, NULL),
(NULL, 7, 5, 44990, 'success', 'TXN-007', '2025-04-20 13:15:00'),
(NULL, 8, 7, 2990, 'refunded', 'TXN-008', '2025-05-15 10:00:00'),
(NULL, 9, 7, 7990, 'success', 'TXN-009', '2025-04-28 08:55:00'),
(NULL, 10, 8, 51990, 'success', 'TXN-010', '2025-05-18 17:40:00'),
(NULL, 11, 1, 890, 'pending', NULL, NULL),
(NULL, 12, 3, 34990, 'pending', NULL, NULL);

INSERT INTO warehouses (id, manager_id, name, city, address, capacity) VALUES
(NULL, 2, 'Склад Москва Север', 'Москва', 'Дмитровское ш. 100', 50000),
(NULL, 2, 'Склад Москва Юг', 'Москва', 'Варшавское ш. 200', 40000),
(NULL, 2, 'Склад Петербург', 'Санкт-Петербург', 'Пулковское ш. 40', 30000),
(NULL, NULL, 'Склад Казань', 'Казань', 'ул. Декабристов 15', 20000),
(NULL, NULL, 'Склад Новосибирск', 'Новосибирск', 'пр. Карла Маркса 55', 25000),
(NULL, NULL, 'Склад Екатеринбург', 'Екатеринбург', 'ул. Малышева 90', 15000),
(NULL, NULL, 'Склад Ростов-на-Дону', 'Ростов-на-Дону', 'пр. Буденновский 80', 12000),
(NULL, NULL, 'Склад Самара', 'Самара', 'Московское ш. 200', 18000),
(NULL, NULL, 'Склад Краснодар', 'Краснодар', 'ул. Красная 60', 10000),
(NULL, NULL, 'Склад Нижний Новгород', 'Нижний Новгород', 'Московское ш. 300', 22000);

INSERT INTO inventory (id, product_id, warehouse_id, quantity, reserved, updated_at) VALUES
(NULL, 1, 1, 25, 3, NULL),
(NULL, 1, 2, 20, 1, NULL),
(NULL, 2, 1, 20, 2, NULL),
(NULL, 3, 1, 8, 1, NULL),
(NULL, 4, 2, 15, 0, NULL),
(NULL, 5, 1, 50, 5, NULL),
(NULL, 5, 3, 30, 0, NULL),
(NULL, 6, 1, 100, 10, NULL),
(NULL, 7, 3, 40, 2, NULL),
(NULL, 8, 2, 3, 1, NULL),
(NULL, 9, 4, 20, 0, NULL),
(NULL, 10, 5, 5, 1, NULL),
(NULL, 11, 1, 15, 0, NULL),
(NULL, 12, 1, 30, 3, NULL),
(NULL, 13, 2, 100, 0, NULL);

INSERT INTO shipments (id, order_id, warehouse_id, courier_id, tracking_number, status, shipped_at, delivered_at) VALUES
(NULL, 1, 1, 12, 'SHIP-10001', 'delivered', '2025-05-02 09:00:00', '2025-05-04 14:00:00'),
(NULL, 2, 1, 12, 'SHIP-10002', 'delivered', '2025-05-04 10:00:00', '2025-05-06 13:00:00'),
(NULL, 3, 3, 12, 'SHIP-10003', 'delivered', '2025-05-06 08:00:00', '2025-05-09 12:00:00'),
(NULL, 4, 2, 12, 'SHIP-10004', 'shipped', '2025-05-11 11:00:00', NULL),
(NULL, 5, 5, NULL, 'SHIP-10005', 'shipped', '2025-05-13 09:00:00', NULL),
(NULL, 7, 2, 12, 'SHIP-10007', 'delivered', '2025-04-21 10:00:00', '2025-04-24 15:00:00'),
(NULL, 9, 1, 12, 'SHIP-10009', 'delivered', '2025-04-29 08:00:00', '2025-05-01 11:00:00'),
(NULL, 10, 3, NULL, 'SHIP-10010', 'shipped', '2025-05-19 14:00:00', NULL),
(NULL, 11, 1, NULL, 'SHIP-10011', 'preparing', NULL, NULL),
(NULL, 12, 1, NULL, 'SHIP-10012', 'preparing', NULL, NULL);

INSERT INTO reviews (id, product_id, user_id, rating, title, body, is_verified, created_at) VALUES
(NULL, 1, 5, 5, 'Отличный смартфон', '''''''''''''''''Быстрый', 'камера супер', NULL),
(NULL, 1, 6, 4, '''''''''''''''''Хороший', 'но дорогой''''''''''''''''', '''''''''''''''''В целом доволен', NULL),
(NULL, 2, 7, 5, 'Бюджетный вариант', 'За эти деньги очень достойный телефон', 'TRUE', NULL),
(NULL, 3, 6, 5, 'Мощный ноутбук', '''''''''''''''''Летает', 'экран отличный', NULL),
(NULL, 4, 5, 4, 'Хороший ноутбук', '''''''''''''''''Производительный', 'немного греется''''''''''''''''', NULL),
(NULL, 5, 8, 5, 'Лучшие наушники', '''''''''''''''''Звук потрясающий', 'шумодав работает отлично''''''''''''''''', NULL),
(NULL, 8, 10, 4, 'Удобный диван', '''''''''''''''''Мягкий', 'хорошо выглядит', NULL),
(NULL, 9, 5, 5, 'Отличная посуда', '''''''''''''''''Красивый набор', 'удобно пользоваться''''''''''''''''', NULL),
(NULL, 10, 7, 5, 'Классный велик', '''''''''''''''''Ходовые качества отменные', 'рекомендую''''''''''''''''', NULL),
(NULL, 12, 8, 5, 'Ребёнок доволен', '''''''''''''''''Качество хорошее', 'деталей много', NULL),
(NULL, 13, 5, 4, 'Вкусный кофе', '''''''''''''''''Аромат приятный', 'мягкий вкус''''''''''''''''', NULL),
(NULL, 14, 6, 5, 'Умная колонка', '''''''''''''''''Голос чёткий', 'музыка громкая', NULL);

INSERT INTO tags (id, name, slug) VALUES
(NULL, 'Хит продаж', 'bestseller'),
(NULL, 'Новинка', 'new'),
(NULL, 'Скидка', 'sale'),
(NULL, 'Эксклюзив', 'exclusive'),
(NULL, 'Эко-товар', 'eco'),
(NULL, 'Премиум', 'premium'),
(NULL, 'Для дома', 'home'),
(NULL, 'Для спорта', 'sport'),
(NULL, 'Для детей', 'kids'),
(NULL, 'Распродажа', 'clearance'),
(NULL, 'Популярное', 'popular'),
(NULL, 'Рекомендуем', 'recommended');

INSERT INTO product_tags (product_id, tag_id) VALUES
(1, 1),
(1, 6),
(1, 12),
(2, 2),
(2, 12),
(3, 1),
(3, 6),
(4, 2),
(4, 12),
(5, 1),
(5, 7),
(6, 3),
(6, 10),
(7, 3),
(7, 2),
(8, 7),
(8, 6),
(9, 7),
(9, 3),
(10, 8),
(10, 1),
(11, 8),
(11, 12),
(12, 9),
(12, 12),
(13, 5),
(13, 4),
(14, 2),
(14, 7);

INSERT INTO discounts (id, name, type, value, min_order_amount, starts_at, ends_at, is_active) VALUES
(NULL, 'Летняя распродажа', 'percent', 15, 1000, '2025-06-01', '2025-08-31', 'TRUE'),
(NULL, 'Чёрная пятница', 'percent', 30, 2000, '2025-11-28', '2025-11-30', 'FALSE'),
(NULL, 'Скидка новому клиенту', 'percent', 10, 500, '2025-01-01', '2025-12-31', 'TRUE'),
(NULL, 'Фиксированная -500р', 'fixed', 500, 5000, '2025-05-01', '2025-06-30', 'TRUE'),
(NULL, 'Майские праздники', 'percent', 20, 3000, '2025-05-01', '2025-05-10', 'FALSE'),
(NULL, 'Скидка на электронику', 'percent', 12, 10000, '2025-06-01', '2025-06-15', 'TRUE'),
(NULL, 'День рождения магазина', 'percent', 25, 100, '2025-07-01', '2025-07-03', 'FALSE'),
(NULL, 'Фиксированная -1000р', 'fixed', 1000, 15000, '2025-06-01', '2025-06-30', 'TRUE'),
(NULL, 'Сезонная -5%', 'percent', 5, 0, '2025-01-01', '2025-12-31', 'TRUE'),
(NULL, 'VIP скидка', 'percent', 18, 1000, '2025-01-01', '2025-12-31', 'TRUE');

INSERT INTO coupon_codes (id, discount_id, code, max_uses, used_count) VALUES
(NULL, 1, 'SUMMER15', 1000, 234),
(NULL, 2, 'BLACK30', 5000, 0),
(NULL, 3, 'WELCOME10', NULL, 87),
(NULL, 4, 'FIXED500', 500, 42),
(NULL, 5, 'MAY20', 2000, 1500),
(NULL, 6, 'TECH12', 300, 18),
(NULL, 7, 'BDAY25', 1000, 0),
(NULL, 8, 'BIG1000', 200, 55),
(NULL, 9, 'SEASON5', NULL, 301),
(NULL, 10, 'VIP18', 100, 12);

INSERT INTO cart (id, user_id, created_at, updated_at) VALUES
(NULL, 5, NULL, NULL),
(NULL, 6, NULL, NULL),
(NULL, 7, NULL, NULL),
(NULL, 8, NULL, NULL),
(NULL, 10, NULL, NULL),
(NULL, 11, NULL, NULL),
(NULL, 3, NULL, NULL),
(NULL, 4, NULL, NULL),
(NULL, 9, NULL, NULL),
(NULL, 12, NULL, NULL);

INSERT INTO cart_items (id, cart_id, product_id, quantity, added_at) VALUES
(NULL, 1, 14, 1, NULL),
(NULL, 2, 15, 1, NULL),
(NULL, 3, 1, 1, NULL),
(NULL, 3, 5, 2, NULL),
(NULL, 4, 9, 1, NULL),
(NULL, 4, 13, 3, NULL),
(NULL, 5, 6, 2, NULL),
(NULL, 6, 4, 1, NULL),
(NULL, 7, 11, 1, NULL),
(NULL, 8, 7, 1, NULL),
(NULL, 9, 12, 1, NULL),
(NULL, 10, 2, 1, NULL);

INSERT INTO wishlist (id, user_id, created_at) VALUES
(NULL, 5, NULL),
(NULL, 6, NULL),
(NULL, 7, NULL),
(NULL, 8, NULL),
(NULL, 10, NULL),
(NULL, 11, NULL),
(NULL, 3, NULL),
(NULL, 4, NULL),
(NULL, 9, NULL),
(NULL, 12, NULL);

INSERT INTO wishlist_items (id, wishlist_id, product_id, added_at) VALUES
(NULL, 1, 3, NULL),
(NULL, 1, 15, NULL),
(NULL, 2, 1, NULL),
(NULL, 2, 5, NULL),
(NULL, 3, 8, NULL),
(NULL, 3, 10, NULL),
(NULL, 4, 3, NULL),
(NULL, 4, 14, NULL),
(NULL, 5, 2, NULL),
(NULL, 5, 7, NULL),
(NULL, 6, 1, NULL),
(NULL, 6, 4, NULL),
(NULL, 7, 13, NULL),
(NULL, 8, 11, NULL),
(NULL, 9, 6, NULL),
(NULL, 9, 9, NULL),
(NULL, 10, 12, NULL);

INSERT INTO suppliers (id, name, country, contact_email, contact_phone, rating) VALUES
(NULL, 'Shenzhen TechImport Ltd', 'Китай', 'supply@techimport.cn', '+86-755-8888-0001', 4.8),
(NULL, 'Samsung Electronics', 'Ю.Корея', 'b2b@samsung.com', '+82-2-2255-0114', 4.9),
(NULL, 'Lenovo Supply Chain', 'Китай', 'supply@lenovo.com', '+86-10-5885-0001', 4.7),
(NULL, 'H&M Group B2B', 'Швеция', 'b2b@hm.com', '+46-8-796-5500', 4.5),
(NULL, 'IKEA Wholesale', 'Нидерланды', 'wholesale@ikea.com', '+31-20-555-0100', 4.6),
(NULL, 'Trek Bicycle Corp', 'США', 'dealer@trek.com', '+1-800-585-8735', 4.85),
(NULL, 'Nestle Professional', 'Швейцария', 'prof@nestle.com', '+41-21-924-2111', 4.4),
(NULL, 'Xiaomi B2B', 'Китай', 'b2b@xiaomi.com', '+86-10-8095-6666', 4.75),
(NULL, 'Bosch Home Appliances', 'Германия', 'trade@bosch.com', '+49-711-400-40990', 4.8),
(NULL, 'Hasbro International', 'США', 'intl@hasbro.com', '+1-401-431-8697', 4.55),
(NULL, 'LG Electronics B2B', 'Ю.Корея', 'b2b@lg.com', '+82-2-3777-1114', 4.7),
(NULL, 'Globus Foods Wholesale', 'Россия', 'opt@globus.ru', '+7-495-780-7070', 4.3);

INSERT INTO supplier_products (id, supplier_id, product_id, supply_price, min_order_qty, lead_time_days) VALUES
(NULL, 2, 1, 18000, 10, 14),
(NULL, 1, 2, 10000, 20, 7),
(NULL, 3, 3, 45000, 5, 21),
(NULL, 3, 4, 30000, 10, 14),
(NULL, 1, 5, 2500, 50, 7),
(NULL, 4, 6, 350, 100, 5),
(NULL, 4, 7, 900, 50, 5),
(NULL, 5, 8, 25000, 2, 30),
(NULL, 9, 9, 1800, 20, 10),
(NULL, 6, 10, 12000, 5, 21),
(NULL, 7, 13, 300, 200, 3),
(NULL, 8, 14, 2500, 20, 7);

INSERT INTO notifications (id, user_id, type, title, body, is_read, created_at) VALUES
(NULL, 5, 'order_status', 'Заказ #1 доставлен', 'Ваш заказ был доставлен. Оцените товары!', 'TRUE', NULL),
(NULL, 5, 'promo', 'Скидка 15% на всё!', 'Только до конца июня — скидка по промокоду SUMMER15', 'FALSE', NULL),
(NULL, 6, 'order_status', 'Заказ #3 доставлен', 'Ноутбук ждёт вас!', 'TRUE', NULL),
(NULL, 7, 'order_status', 'Заказ #4 отправлен', 'Трек-номер: SHIP-10004', 'FALSE', NULL),
(NULL, 7, 'review_reply', 'Ответ на ваш отзыв', 'Спасибо за отзыв о TechPro S5!', 'FALSE', NULL),
(NULL, 8, 'order_status', 'Заказ #7 доставлен', '''''''''''''''''Диван доставлен', 'спасибо за покупку!''''''''''''''''', NULL),
(NULL, 8, 'promo', 'Кешбэк 5% на следующий заказ', 'Используйте накопленный кешбэк', 'FALSE', NULL),
(NULL, 10, 'order_status', 'Заказ #8 отменён', 'Средства возвращены на карту в течение 3 дней', 'TRUE', NULL),
(NULL, 11, 'order_status', 'Заказ #10 отправлен', 'Трек-номер: SHIP-10010', 'FALSE', NULL),
(NULL, 2, 'system', 'Новый продавец зарегистрирован', 'Продавец seller2@market.io прошёл верификацию', 'TRUE', NULL),
(NULL, 5, 'stock_alert', 'Товар снова в наличии', 'ElectroWave BT300 снова есть на складе!', 'FALSE', NULL),
(NULL, 9, 'system', 'Новый тикет #8', 'Клиент Морозов открыл обращение', 'FALSE', NULL);

INSERT INTO support_tickets (id, user_id, order_id, assigned_to, subject, status, priority, created_at, closed_at) VALUES
(NULL, 5, 1, 9, 'Где мой заказ?', 'closed', 'high', NULL, NULL),
(NULL, 6, 3, 9, 'Брак на ноутбуке', 'closed', 'high', NULL, NULL),
(NULL, 7, 4, 9, 'Хочу изменить адрес доставки', 'open', 'medium', NULL, NULL),
(NULL, 8, 8, 9, 'Возврат товара', 'closed', 'high', NULL, NULL),
(NULL, 10, 9, 9, 'Вопрос по гарантии', 'open', 'low', NULL, NULL),
(NULL, 11, 10, 9, 'Не приходит SMS с треком', 'open', 'medium', NULL, NULL),
(NULL, 5, NULL, 9, 'Как применить промокод?', 'closed', 'low', NULL, NULL),
(NULL, 6, NULL, 9, 'Хочу стать продавцом', 'open', 'low', NULL, NULL),
(NULL, 7, 5, 9, 'Задержка доставки', 'open', 'medium', NULL, NULL),
(NULL, 8, NULL, 9, 'Проблема с оплатой', 'closed', 'high', NULL, NULL);

INSERT INTO ticket_messages (id, ticket_id, sender_id, body, sent_at) VALUES
(NULL, 1, 5, '''''''''''''''''Прошло уже 5 дней', NULL),
(NULL, 1, 9, 'Добрый день! Уточняю информацию у курьерской службы.', NULL),
(NULL, 1, 9, 'Заказ был доставлен сегодня в 14:00. Закрываю тикет.', NULL),
(NULL, 2, 6, '''''''''''''''''На ноутбуке царапина на крышке', NULL),
(NULL, 2, 9, 'Приносим извинения. Отправим замену завтра.', NULL),
(NULL, 3, 7, 'Хочу изменить адрес с квартиры на офис.', NULL),
(NULL, 3, 9, '''''''''''''''''К сожалению заказ уже передан в доставку', NULL),
(NULL, 4, 8, '''''''''''''''''Хочу вернуть диван', NULL),
(NULL, 4, 9, 'Оформили заявку на возврат. Курьер приедет в течение 3 дней.', NULL),
(NULL, 7, 5, '''''''''''''''''Есть промокод SUMMER15', NULL),
(NULL, 7, 9, '''''''''''''''''В корзине', NULL),
(NULL, 7, 5, '''''''''''''''''Спасибо', NULL);

INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, old_value, new_value, ip_address, created_at) VALUES
(NULL, 1, 'create', 'product', 1, NULL, NULL, '192.168.1.1', NULL),
(NULL, 1, 'create', 'product', 2, NULL, NULL, '192.168.1.1', NULL),
(NULL, 2, 'update', 'product', 1, NULL, NULL, '10.0.0.5', NULL),
(NULL, 5, 'create', 'order', 1, NULL, NULL, '78.25.121.10', NULL),
(NULL, 5, 'create', 'order', 2, NULL, NULL, '78.25.121.10', NULL),
(NULL, 6, 'create', 'order', 3, NULL, NULL, '95.31.18.44', NULL),
(NULL, 7, 'create', 'order', 4, NULL, NULL, '213.87.135.22', NULL),
(NULL, 8, 'create', 'order', 7, NULL, NULL, '46.48.12.99', NULL),
(NULL, 8, 'cancel', 'order', 8, NULL, NULL, '46.48.12.99', NULL),
(NULL, 1, 'delete', 'coupon', 5, NULL, NULL, '192.168.1.1', NULL),
(NULL, 2, 'update', 'discount', 1, NULL, NULL, '10.0.0.5', NULL),
(NULL, 9, 'close', 'ticket', 1, NULL, NULL, '10.0.0.7', NULL);

INSERT INTO product_attributes (id, product_id, name, value) VALUES
(NULL, 1, 'Цвет', 'Чёрный'),
(NULL, 1, 'Память', '128 ГБ'),
(NULL, 1, 'Процессор', 'Snapdragon 8 Gen 2'),
(NULL, 2, 'Цвет', 'Синий'),
(NULL, 2, 'Память', '64 ГБ'),
(NULL, 3, 'Процессор', 'Intel Core i7-1355U'),
(NULL, 3, 'RAM', '16 ГБ'),
(NULL, 3, 'Накопитель', 'SSD 512 ГБ'),
(NULL, 4, 'Процессор', 'AMD Ryzen 5 7530U'),
(NULL, 4, 'RAM', '8 ГБ'),
(NULL, 5, 'Тип подключения', 'Bluetooth 5.3'),
(NULL, 5, 'Время работы', '40 часов'),
(NULL, 6, 'Размер', 'M'),
(NULL, 6, 'Материал', '100% хлопок'),
(NULL, 10, 'Диаметр колёс', '27.5 дюймов');
