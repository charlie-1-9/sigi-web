import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({
	providedIn: 'root'
})

export class OptionMenuService {
	private miSubject$ = new Subject<string>();

	public data$(): Observable<string> {
		return this.miSubject$.asObservable();
	}

	public sendData(newMenuOption: string): void {
		this.miSubject$.next(newMenuOption);
	}
}
