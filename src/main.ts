import './style.css';
import { startGame } from './game/App';

startGame(document.querySelector<HTMLDivElement>('#app')!);
