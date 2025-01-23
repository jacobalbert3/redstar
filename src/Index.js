import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import './index.css';

//take control of the root: 
const container = document.getElementById("root"); //this is in the index.html file
const root = createRoot(container);
//render the app into the root element:
//MOUNTING THE REACT APP TO THE PAGE
root.render(<App />); //App becomes the top level component of the application: 