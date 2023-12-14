'use strict';
import L, { LeafletMouseEvent } from 'leaflet';
import './style.scss';


type Coordinates = [number, number]; 

class Workout {
  coords: Coordinates;
  distance: number; 
  duration: number; 
  date: Date;
  description: string;
  type: string;
  id: string;

  constructor(coords: Coordinates, distance: number, duration: number,  id?: string) {
    this.coords = coords; 
    this.distance = distance; 
    this.duration = duration; 
    this.date = new Date(); 
    this.id = id || (Date.now() + '').slice(-10);
    this.description = '';
    this.type = ''; 
  }

  protected setDescription(): void {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = 'running';
  cadence: number;
  pace: number;

  constructor(coords: Coordinates, distance: number, duration: number, cadence: number, id?: string) {
    super(coords, distance, duration, id);
    this.cadence = cadence;
    this.pace = 0; 
    this.type = 'running',
    this.calcPace();
    this.setDescription();
  }

  calcPace(): number {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  elevationGain: number;
  speed: number;

  constructor(coords: Coordinates, distance: number, duration: number, elevationGain: number, id?: string) {
    super(coords, distance, duration, id);
    this.elevationGain = elevationGain;
    this.speed = 0; 
    this.type = 'cycling',
    this.calcSpeed();
    this.setDescription();
  }

  calcSpeed(): number {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

class App {
  private map!: L.Map;
  private form: HTMLFormElement | null;
  private inputDistance: HTMLInputElement | null;
  private inputDuration: HTMLInputElement | null;
  private inputCadence: HTMLInputElement | null;
  private inputElevation: HTMLInputElement | null;
  private inputType: HTMLInputElement | null;
  private workouts: (Running | Cycling)[];
  private latitude?: number;
  private longitude?: number;
  private clickedCoords: Coordinates | undefined;
  private containerWorkouts?: HTMLInputElement | null;
  private mapZoomLevel = 13;
  private markers: { [key: string]: L.Marker } = {};
  private scrollDownIcon: HTMLInputElement | null;

  constructor() {
    this.form = document.querySelector('.form');
    this.inputDistance = document.querySelector('.form__input--distance');
    this.inputDuration = document.querySelector('.form__input--duration');
    this.inputCadence = document.querySelector('.form__input--cadence');
    this.inputElevation = document.querySelector('.form__input--elevation');
    this.inputType = document.querySelector('.form__input--type');
    this.containerWorkouts = document.querySelector('.workouts');
    this.scrollDownIcon = document.querySelector('.scroll-down-icon');
    this.workouts = [];
    this.mapZoomLevel = 13;

    this.getPosition();
    this.getLocalStorage();
    this.addEventListeners();
  }

  private getPosition(): void {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this.loadMap.bind(this),
        () => {
          alert('Cannot get your position');
        }
      );
    }
  }

  private addEventListeners() {
    this.form?.addEventListener('submit', this.handleSubmitForm.bind(this))
    this.inputType?.addEventListener('change', this.toggleField.bind(this));
    this.containerWorkouts?.addEventListener('click', this.handleContainerWorkoutsClick.bind(this));
    this.scrollDownIcon?.addEventListener('click', this.handleScrollClick.bind(this));
  }

  private handleScrollClick() {
    this.form?.scrollIntoView({ behavior: 'smooth' });
  }

  private handleSubmitForm(e: SubmitEvent) {
    e.preventDefault();
    this.addNewWorkout();
  }

  private handleContainerWorkoutsClick(e: Event): void {
    const target = e.target as HTMLElement;
  
    if (target.closest('.workout__delete-btn')) {
      const workoutEl = target.closest('.workout') as HTMLElement;
      if (workoutEl && workoutEl.dataset.id) {
        this.deleteWorkout(workoutEl.dataset.id);
      }
    } else if (target.closest('.workout')) {
      this.moveToPopup(e);
    }
  }

  private deleteWorkout(workoutId: string) {
    this.workouts = this.workouts.filter(workout => workout.id !== workoutId);
  
    this.markers[workoutId]?.remove();
    delete this.markers[workoutId];
  
    this.setLocalStorage();

    document.querySelector(`[data-id="${workoutId}"]`)?.remove();
  }

  private addNewWorkout() {
    const type = this.inputType ? this.inputType.value : '';
    const distance = this.inputDistance ? parseFloat(this.inputDistance.value) : NaN;
    const duration = this.inputDuration ? parseFloat(this.inputDuration.value) : NaN;
    const cadenceOrElevation = type === 'running'
      ? (this.inputCadence ? parseFloat(this.inputCadence.value) : NaN)
      : (this.inputElevation ? parseFloat(this.inputElevation.value) : NaN);
    
    if (!this.validInputs(distance, duration) || !this.allPositive(distance, duration)) {
      return alert('Distance and duration must be positive numbers!');
    }
  
    if ((type === 'running' && (!this.validInputs(cadenceOrElevation) || !this.allPositive(cadenceOrElevation))) ||
        (type === 'cycling' && (!this.validInputs(cadenceOrElevation) || !this.allPositive(cadenceOrElevation)))) {
      return alert(`${type === 'running' ? 'Cadence' : 'Elev Gain'} must be a positive number!`);
    }
  
    if (this.clickedCoords) {
      this.addWorkout(type, this.clickedCoords, distance, duration, cadenceOrElevation);
    } else {
      alert('Location not found');
    }
  }

  private addWorkout(type: string, coords: Coordinates, distance: number, duration: number, cadenceOrElevation: number): void {
    let workout: Running | Cycling;
  
    if (type === 'running') {
      workout = new Running(coords, distance, duration, cadenceOrElevation);
    } else if (type === 'cycling') {
      workout = new Cycling(coords, distance, duration, cadenceOrElevation);
    } else {
      return;
    }
  
    this.workouts.push(workout);
    this.renderWorkout(workout);
    this.renderWorkoutMarker(workout);
    this.hideForm();
    this.setLocalStorage();
  }

  private validInputs(...inputs: number[]): boolean {
    return inputs.every(inp => Number.isFinite(inp));
  }

  private allPositive(...inputs: number[]): boolean {
    return inputs.every(inp => inp > 0);
  }

  private loadMap(position: GeolocationPosition): void {
    this.latitude = position.coords.latitude;
    this.longitude = position.coords.longitude;

    if (typeof this.latitude === 'number' && typeof this.longitude === 'number') {
      const coords: L.LatLngExpression = [this.latitude, this.longitude];

      this.map = L.map('map').setView(coords, 13);

      L.tileLayer('https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.map);

      this.workouts.forEach(workout => {
        this.renderWorkoutMarker(workout); 
      })

    }

    this.map.on('click', this.showForm.bind(this));
  }

  private renderWorkoutMarker(workout: Running | Cycling): void {
    const marker = L.marker(workout.coords)
      .addTo(this.map) 
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
  
    this.markers[workout.id] = marker;
  }

  private showForm(e: LeafletMouseEvent) {
    this.clickedCoords = [e.latlng.lat, e.latlng.lng];
    this.form?.classList.remove('hidden');
    this.inputDistance?.focus();
  }

  private hideForm(): void {
    if (this.inputDistance) this.inputDistance.value = '';
    if (this.inputDuration) this.inputDuration.value = '';
    if (this.inputCadence) this.inputCadence.value = '';
    if (this.inputElevation) this.inputElevation.value = '';

    if (this.form) {
      this.form.style.display = 'none';
      this.form.classList.add('hidden');
      setTimeout(() => {
        if (this.form) {
          this.form.style.display = 'grid';
        }
      }, 1000);
    }
  }

  private toggleField() {
    const elevationRow = this.inputElevation?.closest('.form__row');
    const cadenceRow = this.inputCadence?.closest('.form__row');
  
    if (elevationRow && cadenceRow) {
      elevationRow.classList.toggle('form__row--hidden');
      cadenceRow.classList.toggle('form__row--hidden');
    }
  }

  private renderWorkout(workout: Running | Cycling): void {
    const workoutHtml = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <button class="workout__delete-btn">
          <span>X</span>
        </button>
        ${this.createWorkoutTitle(workout)}
        ${this.createWorkoutDetail('🏃‍♂️', workout.distance, 'km')}
        ${this.createWorkoutDetail('⏱', workout.duration, 'min')}
        ${this.getSpecificWorkoutDetails(workout)}
      </li>
    `;
    this.form?.insertAdjacentHTML('afterend', workoutHtml);
  }
  
  private createWorkoutTitle(workout: Running | Cycling): string {
    return `<h2 class="workout__title">${workout.description}</h2>`;
  }
  
  private createWorkoutDetail(icon: string, value: number | string, unit: string): string {
    return `
      <div class="workout__details">
        <span class="workout__icon">${icon}</span>
        <span class="workout__value">${value}</span>
        <span class="workout__unit">${unit}</span>
      </div>
    `;
  }
  
  private getSpecificWorkoutDetails(workout: Running | Cycling): string {
    if (workout instanceof Running) {
      return `
        ${this.createWorkoutDetail('⚡️', workout.pace.toFixed(1), 'min/km')}
        ${this.createWorkoutDetail('🦶🏼', workout.cadence, 'spm')}
      `;
    } else {
      return `
        ${this.createWorkoutDetail('⚡️', workout.speed.toFixed(1), 'km/h')}
        ${this.createWorkoutDetail('⛰', workout.elevationGain, 'm')}
      `;
    }
  }

  private moveToPopup(e: Event): void {
    if (!this.map) return;

    const target = e.target as HTMLElement;
    const workoutEl = target.closest('.workout') as HTMLElement | null;
    if (!workoutEl) return;
    const workout = this.workouts.find(work => work.id === workoutEl.dataset.id);
    if (workout) {
      this.map.setView(workout.coords, this.mapZoomLevel, {
        animate: true,
        duration: 1
      });
    }
  }

  private setLocalStorage(): void {
    console.log(this.workouts)
    localStorage.setItem('workouts', JSON.stringify(this.workouts));
  }


  private getLocalStorage(): void {
    try {
      const data = localStorage.getItem('workouts');
      if (!data) return;
  
      const parsedData = JSON.parse(data);
      this.workouts = parsedData.map((data: any) => {
        const coords: Coordinates = [data.coords[0], data.coords[1]]; 
        if (data.type === 'running') {
          return new Running(coords, data.distance, data.duration, data.cadence, data.id);
        } else if (data.type === 'cycling') {
          return new Cycling(coords, data.distance, data.duration, data.elevationGain, data.id);
        }
      });
  
      this.workouts.forEach(workout => {
        this.renderWorkout(workout);
      });
    } catch (error) {
      console.error('Error reading from localStorage', error);
    }
  }

  public reset(): void {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();

