// Import required Node.js modules
const path = require("path");  // Node.js module for handling file paths
const webpack = require('webpack');  // Import webpack itself
const dotenv = require('dotenv'); // Module to load environment variables from .env file

// Load environment variables based on NODE_ENV
const env = dotenv.config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local'
}).parsed;

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  // Specify the entry point of your application
  entry: "./src/Index.js", // Where webpack starts bundling from
  // Configure where webpack should output the bundled files
  output: {
    // Resolve absolute path to 'public' directory
    path: path.resolve(__dirname, "public"),
    filename: "bundle.js",
    publicPath: '/' // Base path for all assets
  },
 // Configure how different file types should be processed
  module: {
    rules: [
    // Rule for JavaScript/JSX filess
      {
        test: /\.jsx?$/, // Regular expression to match .js and .jsx files
        exclude: /node_modules/, // Don't process files in node_modules
        use: {
          loader: "babel-loader"
        }
      },
      // Rule for CSS files
      {
        test: /\.css$/,  // Match .css files
        use: ["style-loader", "css-loader"],
      },
    ],
  },
// Configure how modules are resolved
  resolve: {
    extensions: [".js", ".jsx"],// Allow importing these files without extensions
  },
  //i.e if try to import MyComponent from './MyComponent' will auto resolve with Component.Js

// Development server configuration
  devServer: {
    static: {
      directory: path.join(__dirname, "public"),
    },
    compress: true,  // Enable gzip compression
    port: 9000, // Port to run dev server on
    host: '0.0.0.0', // Add this to allow external connections
    hot: true, // Enable hot module replacement
    historyApiFallback: true, // Redirect 404s to index.html (for SPA routing)
    proxy: [{
      context: ['/api', '/socket.io'],
      target: 'http://localhost:3000',
      ws: true,
      changeOrigin: true,
      secure: false
    }],
    allowedHosts: 'all'
  },
 // Configure webpack plugins
  plugins: [
    new webpack.DefinePlugin({
      'process.env': JSON.stringify(env),
      'process.env.REACT_APP_MAPBOX_API_KEY': JSON.stringify(process.env.REACT_APP_MAPBOX_API_KEY)
    })
  ],
  devtool: 'source-map'
};
