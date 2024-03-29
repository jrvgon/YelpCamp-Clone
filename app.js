// if (process.env.NODE_ENV !== 'production') {
// 	require('dotenv').config()
// }

require('dotenv').config()

const express = require('express')
const path = require('path')
// const mongodb = require('mongodb')
const mongoose = require('mongoose')
const ejsMate = require('ejs-mate')
const session = require('express-session')
const flash = require('connect-flash')
const ExpressError = require('./utils/ExpressError')
const methodOverride = require('method-override')
const passport = require('passport')
const LocalStrategy = require('passport-local')
const User = require('./models/user')
const helmet = require('helmet')

const mongoSanitize = require('express-mongo-sanitize')

// Requiring routes from the routes folder.
const userRoutes = require('./routes/users')
const campgroundRoutes = require('./routes/campgrounds')
const reviewRoutes = require('./routes/reviews')
const { Store } = require('express-session')
const MongoDBStore = require('connect-mongo')
const dbUrl = process.env.DB_URL || 'mongodb://localhost:27017/yelp-camp'
// 'mongodb://localhost:27017/yelp-camp'
mongoose.connect(dbUrl, {
	useNewUrlParser: true,
	// useCreateIndex: true, Not needed after Mongoose v5....
	useUnifiedTopology: true,
})

const db = mongoose.connection
db.on('error', console.error.bind(console, 'connection error'))
db.once('open', () => {
	console.log('Database connected')
})

const app = express()

// All Express, Mongoose, ejs-mate and Method-Override middleware.
app.engine('ejs', ejsMate)
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(express.urlencoded({ extended: true }))
app.use(methodOverride('_method'))
app.use(express.static(path.join(__dirname, 'public')))
app.use(mongoSanitize())

const secret = process.env.SECRET || 'thisshouldbeabettersecret!'

const store = new MongoDBStore({
	mongoUrl: dbUrl,
	touchAfter: 24 * 60 * 60,
	crypto: {
		secret,
	},
})

store.on('error', function (e) {
	console.log('SESSION STORE ERROR', e)
})

const sessionConfig = {
	store,
	name: 'session',
	secret,
	resave: false,
	saveUninitialized: true,
	cookie: {
		httpOnly: true,
		// secure: true,
		expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
		maxAge: 1000 * 60 * 60 * 24 * 7,
	},
}
app.use(session(sessionConfig))
app.use(flash())
app.use(helmet())

const scriptSrcUrls = [
	'https://stackpath.bootstrapcdn.com',
	'https://api.tiles.mapbox.com',
	'https://api.mapbox.com',
	'https://kit.fontawesome.com',
	'https://cdnjs.cloudflare.com',
	'https://cdn.jsdelivr.net',
	'https://code.jquery.com',
]
const styleSrcUrls = [
	'https://kit-free.fontawesome.com',
	'https://stackpath.bootstrapcdn.com',
	'https://api.mapbox.com',
	'https://api.tiles.mapbox.com',
	'https://fonts.googleapis.com',
	'https://use.fontawesome.com',
	'https://cdn.jsdelivr.net',
]
const connectSrcUrls = [
	'https://api.mapbox.com',
	'https://*.tiles.mapbox.com',
	'https://events.mapbox.com',
]
const fontSrcUrls = []
app.use(
	helmet.contentSecurityPolicy({
		directives: {
			defaultSrc: [],
			connectSrc: ["'self'", ...connectSrcUrls],
			scriptSrc: ["'unsafe-inline'", "'self'", ...scriptSrcUrls],
			styleSrc: ["'self'", "'unsafe-inline'", ...styleSrcUrls],
			workerSrc: ["'self'", 'blob:'],
			childSrc: ['blob:'],
			objectSrc: [],
			imgSrc: [
				"'self'",
				'blob:',
				'data:',
				'https://res.cloudinary.com/drgt0t014/', //SHOULD MATCH YOUR CLOUDINARY ACCOUNT!
				'https://images.unsplash.com',
			],
			fontSrc: ["'self'", ...fontSrcUrls],
		},
	})
)

app.use(passport.initialize())
app.use(passport.session())
passport.use(new LocalStrategy(User.authenticate()))

passport.serializeUser(User.serializeUser())
passport.deserializeUser(User.deserializeUser())

// connect-flash middleware
app.use((req, res, next) => {
	// console.log(req.query)
	res.locals.currentUser = req.user
	res.locals.success = req.flash('success')
	res.locals.error = req.flash('error')
	next()
})

// Express router middleware(route handlers).
app.use('/', userRoutes)
app.use('/campgrounds', campgroundRoutes)
app.use('/campgrounds/:id/reviews', reviewRoutes)

// 'Home' route created in the beginning of the app...
app.get('/', (req, res) => {
	res.render('home')
})

// Middleware to catch all Express errors.
app.all('*', (req, res, next) => {
	next(new ExpressError('Page Not Found', 404))
})

// Middleware to catch all Mongoose errors.
app.use((err, req, res, next) => {
	const { statusCode = 500 } = err
	if (!err.message) err.message = 'Oh no, Something went wrong!'
	res.status(statusCode).render('error', { err })
})

const port = process.env.PORT || 3000
// Starting an Express developement server.
app.listen(port, () => {
	console.log(`Serving on port ${port}`)
})
