--
-- PostgreSQL database dump
--

\restrict 71DoW064jKqoJuIjR5wGa5P2bNvDFa5fhvS4eqvEwhADPple7BhhwWyizhdlYRD

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: daily_counts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_counts (
    location_id integer NOT NULL,
    species_id integer NOT NULL,
    count_date date NOT NULL,
    year smallint NOT NULL,
    fish_count integer
);


--
-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    location_id integer NOT NULL,
    name text NOT NULL,
    latitude double precision,
    longitude double precision
);


--
-- Name: series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.series (
    location_id integer NOT NULL,
    species_id integer NOT NULL,
    run text,
    first_year smallint,
    last_year smallint,
    n_records integer,
    loaded_at timestamp with time zone DEFAULT now()
);


--
-- Name: species; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.species (
    species_id integer NOT NULL,
    name text NOT NULL
);


--
-- Name: staging_counts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staging_counts (
    metadata_location_name text,
    metadata_series_label text,
    metadata_start_year text,
    metadata_end_year text,
    latitude text,
    longitude text,
    resolved_location_name text,
    resolved_location_id text,
    resolved_species_name text,
    resolved_species_id text,
    year text,
    count_date text,
    fish_count text,
    species text,
    species_id text,
    count_location text,
    count_location_id text,
    downloaded_at_utc text
);


--
-- Name: daily_counts daily_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_counts
    ADD CONSTRAINT daily_counts_pkey PRIMARY KEY (location_id, species_id, count_date);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (location_id);


--
-- Name: series series_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series
    ADD CONSTRAINT series_pkey PRIMARY KEY (location_id, species_id);


--
-- Name: species species_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.species
    ADD CONSTRAINT species_pkey PRIMARY KEY (species_id);


--
-- Name: daily_counts_species_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX daily_counts_species_year_idx ON public.daily_counts USING btree (species_id, year);


--
-- Name: daily_counts daily_counts_location_id_species_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_counts
    ADD CONSTRAINT daily_counts_location_id_species_id_fkey FOREIGN KEY (location_id, species_id) REFERENCES public.series(location_id, species_id);


--
-- Name: series series_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series
    ADD CONSTRAINT series_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(location_id);


--
-- Name: series series_species_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series
    ADD CONSTRAINT series_species_id_fkey FOREIGN KEY (species_id) REFERENCES public.species(species_id);


--
-- PostgreSQL database dump complete
--

\unrestrict 71DoW064jKqoJuIjR5wGa5P2bNvDFa5fhvS4eqvEwhADPple7BhhwWyizhdlYRD

